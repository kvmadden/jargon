// Pure policy + scanner for pre-deploy's Edge Function auth gate.
//
// Keep exemptions narrow: an allowlist exemption does not imply a JWT
// exemption. Every entry records why the broader gate would make the function
// impossible to use safely.

import ts from 'typescript';

export const ALLOWLIST_EXEMPTIONS = new Map([
  [
    'accept-gift-invite',
    'The recipient is added to the allowlist by accepting the invite.',
  ],
  [
    'preview-gift-invite',
    'The invite recipient has not been added to the allowlist yet.',
  ],
  [
    'delete-account',
    'Account closure must remain available after allowlist access is revoked.',
  ],
  [
    'ingest-terms',
    'The non-user-facing cron endpoint uses service-role bearer authentication.',
  ],
]);

export const JWT_EXEMPTIONS = new Map([
  [
    'ingest-terms',
    'The non-user-facing cron endpoint uses service-role bearer authentication.',
  ],
]);

function unwrapFallback(expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  if (
    ts.isBinaryExpression(current) &&
    (current.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      current.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    return unwrapFallback(current.left);
  }
  return current;
}

function isString(expression, expected) {
  const unwrapped = unwrapFallback(expression);
  return (
    (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) &&
    unwrapped.text === expected
  );
}

function isNamedCall(node, name) {
  if (!ts.isCallExpression(node)) return false;
  if (ts.isIdentifier(node.expression)) return node.expression.text === name;
  return (
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === name
  );
}

function isAuthorizationHeaderRead(expression) {
  const call = unwrapFallback(expression);
  if (
    !ts.isCallExpression(call) ||
    !ts.isPropertyAccessExpression(call.expression) ||
    call.expression.name.text !== 'get' ||
    call.arguments.length !== 1 ||
    !isString(call.arguments[0], 'authorization')
  ) {
    return false;
  }
  const headers = call.expression.expression;
  return (
    ts.isPropertyAccessExpression(headers) &&
    headers.name.text === 'headers'
  );
}

function isServiceRoleKeyRead(expression) {
  const call = unwrapFallback(expression);
  if (
    !ts.isCallExpression(call) ||
    !ts.isPropertyAccessExpression(call.expression) ||
    call.expression.name.text !== 'get' ||
    call.arguments.length !== 1 ||
    !isString(call.arguments[0], 'SUPABASE_SERVICE_ROLE_KEY')
  ) {
    return false;
  }
  const env = call.expression.expression;
  return (
    ts.isPropertyAccessExpression(env) &&
    ts.isIdentifier(env.expression) &&
    env.expression.text === 'Deno' &&
    env.name.text === 'env'
  );
}

function identifierName(expression) {
  const unwrapped = unwrapFallback(expression);
  return ts.isIdentifier(unwrapped) ? unwrapped.text : null;
}

function isBearerExtraction(expression, authorizationVariables) {
  const unwrapped = unwrapFallback(expression);
  if (!ts.isConditionalExpression(unwrapped)) return false;

  const condition = unwrapFallback(unwrapped.condition);
  const whenTrue = unwrapFallback(unwrapped.whenTrue);
  if (
    !ts.isCallExpression(condition) ||
    !ts.isPropertyAccessExpression(condition.expression) ||
    condition.expression.name.text !== 'startsWith' ||
    condition.arguments.length !== 1 ||
    !isString(condition.arguments[0], 'Bearer ') ||
    !ts.isCallExpression(whenTrue) ||
    !ts.isPropertyAccessExpression(whenTrue.expression) ||
    whenTrue.expression.name.text !== 'slice' ||
    whenTrue.arguments.length !== 1 ||
    !ts.isNumericLiteral(whenTrue.arguments[0]) ||
    whenTrue.arguments[0].text !== '7' ||
    !isString(unwrapped.whenFalse, '')
  ) {
    return false;
  }

  const conditionReceiver = identifierName(condition.expression.expression);
  const sliceReceiver = identifierName(whenTrue.expression.expression);
  return (
    conditionReceiver !== null &&
    conditionReceiver === sliceReceiver &&
    authorizationVariables.has(conditionReceiver)
  );
}

function strictMismatchPairs(expression) {
  const matches = [];
  function visit(node) {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
    ) {
      const left = identifierName(node.left);
      const right = identifierName(node.right);
      if (left && right) matches.push([left, right]);
    }
    ts.forEachChild(node, visit);
  }
  visit(expression);
  return matches;
}

function containsReturn(statement) {
  let found = false;
  function visit(node) {
    if (ts.isReturnStatement(node)) found = true;
    if (
      !found &&
      node !== statement &&
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node))
    ) {
      return;
    }
    if (!found) ts.forEachChild(node, visit);
  }
  visit(statement);
  return found;
}

export function inspectEdgeFunctionAuth(name, source) {
  const sourceFile = ts.createSourceFile(
    `${name}.ts`,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const authorizationVariables = new Set();
  const serviceRoleVariables = new Set();
  const bearerTokenVariables = new Set();
  let hasAllowlist = false;
  let hasJwtCheck = false;

  function collect(node) {
    if (ts.isCallExpression(node)) {
      if (isNamedCall(node, 'isAllowlisted')) hasAllowlist = true;
      if (
        isNamedCall(node, 'getUserFromJWT') &&
        node.arguments.length > 0 &&
        identifierName(node.arguments[0]) === 'jwt'
      ) {
        hasJwtCheck = true;
      }
      if (
        isNamedCall(node, 'getUser') &&
        node.arguments.length > 0 &&
        identifierName(node.arguments[0]) === 'jwt' &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        node.expression.expression.name.text === 'auth'
      ) {
        hasJwtCheck = true;
      }
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      if (isAuthorizationHeaderRead(node.initializer)) {
        authorizationVariables.add(node.name.text);
      }
      if (isServiceRoleKeyRead(node.initializer)) {
        serviceRoleVariables.add(node.name.text);
      }
    }
    ts.forEachChild(node, collect);
  }
  collect(sourceFile);

  function collectBearerVariables(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isBearerExtraction(node.initializer, authorizationVariables)
    ) {
      bearerTokenVariables.add(node.name.text);
    }
    ts.forEachChild(node, collectBearerVariables);
  }
  collectBearerVariables(sourceFile);

  let hasExactServiceRoleComparison = false;
  let hasFailClosedServiceRoleGuard = false;
  function inspectGuards(node) {
    if (ts.isIfStatement(node)) {
      for (const [left, right] of strictMismatchPairs(node.expression)) {
        const isTokenKeyPair =
          (bearerTokenVariables.has(left) && serviceRoleVariables.has(right)) ||
          (bearerTokenVariables.has(right) && serviceRoleVariables.has(left));
        if (isTokenKeyPair) {
          hasExactServiceRoleComparison = true;
          if (containsReturn(node.thenStatement)) {
            hasFailClosedServiceRoleGuard = true;
          }
        }
      }
    }
    ts.forEachChild(node, inspectGuards);
  }
  inspectGuards(sourceFile);

  const hasAuthorizationHeaderRead = authorizationVariables.size > 0;
  const hasBearerExtraction = bearerTokenVariables.size > 0;
  const hasServiceRoleKeyRead = serviceRoleVariables.size > 0;
  const hasServiceRoleAuth =
    hasAuthorizationHeaderRead &&
    hasBearerExtraction &&
    hasServiceRoleKeyRead &&
    hasExactServiceRoleComparison &&
    hasFailClosedServiceRoleGuard;
  const findings = [];

  if (!hasJwtCheck && !JWT_EXEMPTIONS.has(name)) {
    findings.push('missing JWT check (supabase.auth.getUser)');
  }
  if (!hasAllowlist && !ALLOWLIST_EXEMPTIONS.has(name)) {
    findings.push('missing isAllowlisted gate');
  }
  if (JWT_EXEMPTIONS.has(name) && !hasServiceRoleAuth) {
    findings.push('JWT-exempt but missing fail-closed exact service-role bearer guard');
  }

  return {
    findings,
    hasAuthorizationHeaderRead,
    hasAllowlist,
    hasBearerExtraction,
    hasExactServiceRoleComparison,
    hasFailClosedServiceRoleGuard,
    hasJwtCheck,
    hasServiceRoleAuth,
    hasServiceRoleKeyRead,
  };
}
