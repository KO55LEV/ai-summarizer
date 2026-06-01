export const delay = (ms = 250): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));
