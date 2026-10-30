-- jargon Stage B+1.29 - machine learning foundations literacy pack
-- https://supabase.com/dashboard/project/jargon-local/sql/new
--
-- Adds: 15 AI-domain terms for practical machine learning basics:
-- training data, labels, features, models, inference, classification,
-- regression, overfitting, generalization, validation sets, test sets,
-- precision, recall, gradient descent, and loss functions.
--
-- Scope:
--   - terms rows only
--   - AI domain only
--   - no profile/rendering cache rewrites
--
-- IDEMPOTENT: on-conflict do nothing. Safe to re-apply.

insert into terms (
  id, term, pronunciation, path, domain, difficulty,
  one_line_definition, long_definition, example_in_sentence, why_it_matters,
  related_terms, prerequisites, stretch_term,
  multiple_choice_distractors, fill_in_blank_sentence, use_in_sentence_prompt,
  source, reviewed_by, reviewed_at
) values

('ml-training-data', 'training data', null, 'ai-foundations', 'ai', 1,
 'Examples used to teach a model the pattern it should learn.',
 'Training data is the set of examples a model learns from. For a spam detector, it might be many emails marked spam or not spam. For an image model, it might be images paired with descriptions. The quality, size, and bias of the training data shape what the model can learn.',
 'The image model struggled with receipts because the training data barely included any receipt photos.',
 'Training data is where many model strengths and failures begin. It helps you ask whether the model learned from the right examples instead of treating model behavior as magic.',
 ARRAY['ml-label','ml-feature','ml-model','ml-generalization']::text[],
 ARRAY[]::text[],
 'ml-validation-set',
 ARRAY[
   'A browser cache used to save network responses',
   'A deployment branch used for preview builds',
   'A user role that grants admin access'
 ]::text[],
 'The image model struggled with receipts because the ___ barely included any receipt photos.',
 'Use ''training data'' in a sentence about examples a model learns from.',
 'curated', 'curator', '2026-05-25'),

('ml-label', 'label', null, 'ai-foundations', 'ai', 1,
 'The known answer attached to an example during supervised learning.',
 'A label is the answer attached to a training example. If an email is marked spam, spam is the label. If a photo is tagged as a dog, dog is the label. Supervised learning depends on labels because the model compares its guess with the known answer.',
 'The dataset had product photos, but the category labels were inconsistent.',
 'Label is the word behind supervised learning. It helps you hear whether a team has actual answers to train against or only raw unlabeled data.',
 ARRAY['ml-training-data','ml-classification','ml-supervised-learning']::text[],
 ARRAY['ml-training-data']::text[],
 'ml-feature',
 ARRAY[
   'A model file stored after training',
   'A request header sent by a browser',
   'A package version number'
 ]::text[],
 'The dataset had product photos, but the category ___s were inconsistent.',
 'Use ''label'' in a sentence about known answers in training data.',
 'curated', 'curator', '2026-05-25'),

('ml-feature', 'feature', null, 'ai-foundations', 'ai', 1,
 'An input signal a model can use to make a prediction.',
 'A feature is one piece of input information the model can learn from. For a churn model, features might include account age, recent activity, plan type, and support-ticket count. Feature does not mean a product capability here; it means a signal in the data.',
 'Account age and last-login date were useful features for predicting churn.',
 'Feature is easy to misread because product teams use the same word differently. In ML, it means input signal, not a button or capability.',
 ARRAY['ml-training-data','ml-model','ml-prediction']::text[],
 ARRAY['ml-training-data']::text[],
 'ml-model',
 ARRAY[
   'A UI change shipped behind a flag',
   'A Git branch that holds a change',
   'A browser cookie for a session'
 ]::text[],
 'Account age and last-login date were useful ___s for predicting churn.',
 'Use ''feature'' in a sentence about an input signal for a model.',
 'curated', 'curator', '2026-05-25'),

('ml-model', 'model', null, 'ai-foundations', 'ai', 1,
 'A learned function that turns inputs into predictions or outputs.',
 'In machine learning, a model is the learned pattern produced by training. It takes input features and returns a prediction, score, class, or generated output. The model is not the dataset or the code alone; it is the learned behavior created from both.',
 'The fraud model scores each transaction before the payment is approved.',
 'Model is the central noun in ML conversations. It helps you separate training data, training code, and the learned system that actually makes predictions.',
 ARRAY['ml-training-data','ml-feature','ml-inference','aid-model']::text[],
 ARRAY['ml-training-data','ml-feature']::text[],
 'ml-inference',
 ARRAY[
   'A row in a database table',
   'A bundle of permissions assigned to a user',
   'A source map created by a build'
 ]::text[],
 'The fraud ___ scores each transaction before the payment is approved.',
 'Use ''model'' in a sentence about a learned prediction system.',
 'curated', 'curator', '2026-05-25'),

('ml-inference', 'inference', null, 'ai-foundations', 'ai', 1,
 'Running a trained model to get an answer on new input.',
 'Inference is what happens after training: the model receives new input and produces an answer. Training teaches the model; inference uses the trained model. A chatbot answering, a fraud score being calculated, or an image classifier naming a photo are all inference.',
 'The app runs inference when you uploads a screenshot and asks what it shows.',
 'Inference helps you know whether a team is talking about building a model or using one. It is the runtime side of ML.',
 ARRAY['ml-model','ml-training-data','ml-prediction','aid-inference']::text[],
 ARRAY['ml-model']::text[],
 'ml-classification',
 ARRAY[
   'Collecting the original examples for training',
   'Writing a database migration',
   'Assigning a user to a role'
 ]::text[],
 'The app runs ___ when you uploads a screenshot and asks what it shows.',
 'Use ''inference'' in a sentence about using a trained model.',
 'curated', 'curator', '2026-05-25'),

('ml-classification', 'classification', null, 'ai-foundations', 'ai', 1,
 'Predicting which category an input belongs to.',
 'Classification is a model task where the answer is a category. Spam or not spam, urgent or normal, receipt or invoice, dog or cat: those are classification outputs. The model chooses from classes rather than predicting an open-ended number.',
 'The support classifier sorted each ticket into billing, bug, or account categories.',
 'Classification is the category-prediction word. It helps you understand many everyday AI features that sort, route, tag, or moderate things.',
 ARRAY['ml-label','ml-model','ml-precision','ml-recall']::text[],
 ARRAY['ml-label','ml-model']::text[],
 'ml-precision',
 ARRAY[
   'Predicting a continuous number',
   'Generating a build artifact',
   'Encrypting data with a key'
 ]::text[],
 'The support ___ sorted each ticket into billing, bug, or account categories.',
 'Use ''classification'' in a sentence about predicting a category.',
 'curated', 'curator', '2026-05-25'),

('ml-regression', 'regression', null, 'ai-foundations', 'ai', 2,
 'Predicting a continuous number instead of a category.',
 'Regression is a model task where the answer is a number on a scale: price, demand, risk score, delivery time, churn probability, or temperature. This is different from a software regression, which means an old bug came back.',
 'The revenue model used regression to predict next month''s sales.',
 'Regression is a repeated word with two meanings. you need the ML meaning for prediction talk and the software meaning for QA talk.',
 ARRAY['ml-model','ml-feature','ml-loss-function']::text[],
 ARRAY['ml-model','ml-feature']::text[],
 'ml-loss-function',
 ARRAY[
   'Predicting one category from a fixed list',
   'A test that catches an old bug returning',
   'A browser redirect between URLs'
 ]::text[],
 'The revenue model used ___ to predict next month''s sales.',
 'Use ''regression'' in a sentence about predicting a number.',
 'curated', 'curator', '2026-05-25'),

('ml-overfitting', 'overfitting', null, 'ai-foundations', 'ai', 2,
 'When a model memorizes training examples and fails on new cases.',
 'Overfitting happens when a model performs very well on training data but poorly on new examples. It learned the quirks of the training set instead of the reusable pattern. A model can look brilliant in practice runs and still fail in the real world because of overfitting.',
 'The model aced the training examples but failed on new users, which pointed to overfitting.',
 'Overfitting explains why a demo or benchmark can look good while the real product disappoints. It is one of the first sanity-check words in ML.',
 ARRAY['ml-training-data','ml-generalization','ml-validation-set']::text[],
 ARRAY['ml-training-data','ml-model']::text[],
 'ml-generalization',
 ARRAY[
   'A server taking too long to answer',
   'A cache serving an old bundle',
   'A user lacking permission for an action'
 ]::text[],
 'The model aced the training examples but failed on new users, which pointed to ___.',
 'Use ''overfitting'' in a sentence about memorizing training examples too closely.',
 'curated', 'curator', '2026-05-25'),

('ml-generalization', 'generalization', null, 'ai-foundations', 'ai', 2,
 'How well a model handles examples it did not train on.',
 'Generalization is the real test of whether a model learned a reusable pattern. A model with good generalization works on new users, new wording, new photos, or new conditions that were not copied from its training set.',
 'The validation score improved, but the team still checked generalization on a new customer segment.',
 'Generalization is the antidote to memorization. It helps you ask whether a model is actually useful outside the examples it already saw.',
 ARRAY['ml-overfitting','ml-validation-set','ml-test-set']::text[],
 ARRAY['ml-overfitting']::text[],
 'ml-test-set',
 ARRAY[
   'The speed of a network request',
   'A role-based permission check',
   'A generated source map'
 ]::text[],
 'The validation score improved, but the team still checked ___ on a new customer segment.',
 'Use ''generalization'' in a sentence about a model working on new examples.',
 'curated', 'curator', '2026-05-25'),

('ml-validation-set', 'validation set', null, 'ai-foundations', 'ai', 2,
 'Held-out examples used to tune and compare models while developing them.',
 'A validation set is data the model does not train on but the team checks during development. It helps compare model versions, choose settings, and catch overfitting before a final test. It is not the final exam; it is the practice exam used while tuning.',
 'The team used the validation set to pick the better threshold before touching the test set.',
 'Validation set helps you understand why teams split data. It keeps tuning honest enough without spending the final test too early.',
 ARRAY['ml-training-data','ml-test-set','ml-overfitting']::text[],
 ARRAY['ml-training-data','ml-overfitting']::text[],
 'ml-test-set',
 ARRAY[
   'A seed file loaded into local development',
   'A production database backup',
   'A browser session cookie'
 ]::text[],
 'The team used the ___ to pick the better threshold before touching the test set.',
 'Use ''validation set'' in a sentence about tuning a model during development.',
 'curated', 'curator', '2026-05-25'),

('ml-test-set', 'test set', null, 'ai-foundations', 'ai', 2,
 'Held-out examples used for a final unbiased model check.',
 'A test set is held back until the end so the team can measure the model on data it did not train on or tune against. If the team keeps checking it while making decisions, it stops being a clean final check.',
 'The model looked ready only after it held up on the untouched test set.',
 'Test set is the final-exam word. It helps you hear whether a model score is a real evaluation or just another tuning result.',
 ARRAY['ml-validation-set','ml-generalization','ml-overfitting']::text[],
 ARRAY['ml-validation-set','ml-generalization']::text[],
 'ml-precision',
 ARRAY[
   'A local folder of generated dependencies',
   'A queue of background jobs',
   'A public route path'
 ]::text[],
 'The model looked ready only after it held up on the untouched ___.',
 'Use ''test set'' in a sentence about final model evaluation.',
 'curated', 'curator', '2026-05-25'),

('ml-precision', 'precision', null, 'ai-foundations', 'ai', 2,
 'How often positive predictions are actually correct.',
 'Precision answers: when the model says yes, how often is it right? In a spam filter, high precision means messages flagged as spam really are spam. Precision matters when false positives are costly.',
 'The moderation model needed high precision so safe posts were not removed by mistake.',
 'Precision is one half of the precision/recall tradeoff. It helps you ask whether a model is being careful about false alarms.',
 ARRAY['ml-classification','ml-recall','ml-test-set']::text[],
 ARRAY['ml-classification']::text[],
 'ml-recall',
 ARRAY[
   'How many real positives the model finds',
   'How fast the model returns an answer',
   'How much data the model can read at once'
 ]::text[],
 'The moderation model needed high ___ so safe posts were not removed by mistake.',
 'Use ''precision'' in a sentence about avoiding false positives.',
 'curated', 'curator', '2026-05-25'),

('ml-recall', 'recall', null, 'ai-foundations', 'ai', 2,
 'How many real positives the model successfully finds.',
 'Recall answers: out of everything the model should catch, how much did it catch? In a medical screening model, high recall means fewer real cases are missed. Recall matters when false negatives are costly.',
 'The fraud system needed high recall so suspicious transactions did not slip through.',
 'Recall is the other half of the precision/recall tradeoff. It helps you hear whether a model is missing too much important stuff.',
 ARRAY['ml-classification','ml-precision','ml-test-set']::text[],
 ARRAY['ml-classification']::text[],
 'ml-precision',
 ARRAY[
   'How often positive predictions are correct',
   'How quickly a server answers',
   'How many tokens fit in a prompt'
 ]::text[],
 'The fraud system needed high ___ so suspicious transactions did not slip through.',
 'Use ''recall'' in a sentence about avoiding missed positives.',
 'curated', 'curator', '2026-05-25'),

('ml-gradient-descent', 'gradient descent', null, 'ai-foundations', 'ai', 3,
 'An optimization method that nudges model weights toward lower error.',
 'Gradient descent is a training method for reducing model error step by step. The loss function says how wrong the model was; the gradient points which direction changes should move; descent means taking small steps toward lower loss.',
 'Training used gradient descent to adjust the model after each batch of examples.',
 'Gradient descent is the phrase behind "the model learns from mistakes." you do not need the calculus first; you need the mental model of small error-reducing steps.',
 ARRAY['ml-loss-function','ml-training-data','aid-weights']::text[],
 ARRAY['ml-loss-function','ml-training-data']::text[],
 'aid-weights',
 ARRAY[
   'A held-out set for final testing',
   'A browser rule for cross-origin requests',
   'A role that grants permissions'
 ]::text[],
 'Training used ___ to adjust the model after each batch of examples.',
 'Use ''gradient descent'' in a sentence about reducing model error during training.',
 'curated', 'curator', '2026-05-25'),

('ml-loss-function', 'loss function', null, 'ai-foundations', 'ai', 3,
 'The error score a model tries to minimize during training.',
 'A loss function turns the model''s mistake into a number. During training, the system tries to lower that number. Different loss functions reward different behavior, so choosing one shapes what the model learns to care about.',
 'The team changed the loss function because the model was optimizing the wrong kind of mistake.',
 'Loss function is the target the training loop is chasing. It helps you understand why "optimize for X" has to be made precise before a model can learn.',
 ARRAY['ml-gradient-descent','ml-training-data','ml-regression']::text[],
 ARRAY['ml-model','ml-training-data']::text[],
 'ml-gradient-descent',
 ARRAY[
   'A final held-out evaluation set',
   'A one-way security fingerprint',
   'A local terminal command interpreter'
 ]::text[],
 'The team changed the ___ because the model was optimizing the wrong kind of mistake.',
 'Use ''loss function'' in a sentence about the error score a model tries to lower.',
 'curated', 'curator', '2026-05-25')

on conflict (id) do nothing;
