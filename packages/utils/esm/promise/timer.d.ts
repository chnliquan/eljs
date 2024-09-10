/**
 * 睡眠 ms 毫秒
 * @param ms 毫秒
 */
export declare function sleep(ms: number): Promise<void>
/**
 * 超时拒绝
 * @param promise promise
 * @param ms 超时时间
 */
export declare function timeout<T>(promise: Promise<T>, ms: number): Promise<T>
//# sourceMappingURL=timer.d.ts.map
