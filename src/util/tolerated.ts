export async function tolerated<T>(meta: { procedure: string; [key: string]: unknown }, fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error: unknown) {
    console.log("tolerated: Error occurred.", { error, meta });
    return null;
  }
}
