const MAX_CAPTURE_WIDTH = 1280;
const MAX_DATA_URL_CHARS = 1_900_000;

export async function captureFeedbackScreenshot(): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  const { default: html2canvas } = await import('html2canvas-pro');

  const canvas = await html2canvas(document.documentElement, {
    backgroundColor: null,
    logging: false,
    useCORS: true,
    scale: Math.min(window.devicePixelRatio || 1, 1.25),
    width: window.innerWidth,
    height: window.innerHeight,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    ignoreElements: (element) => element.hasAttribute('data-feedback-ui'),
  });

  const ratio = Math.min(1, MAX_CAPTURE_WIDTH / canvas.width);
  const output = document.createElement('canvas');
  output.width = Math.max(1, Math.round(canvas.width * ratio));
  output.height = Math.max(1, Math.round(canvas.height * ratio));
  const context = output.getContext('2d');
  if (!context) return null;
  context.drawImage(canvas, 0, 0, output.width, output.height);

  for (const quality of [0.72, 0.58, 0.44]) {
    const dataUrl = output.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_DATA_URL_CHARS) return dataUrl;
  }
  return null;
}
