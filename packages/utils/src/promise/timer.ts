/**
 * 睡眠 ms 毫秒
 * @param ms 毫秒
 */
export function sleep(ms?: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
