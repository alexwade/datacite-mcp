export declare class DataCiteClient {
    private limiter;
    constructor();
    private fetchWithRetry;
    get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T>;
    getUrl<T>(targetUrl: string): Promise<T>;
    getText(targetUrl: string, accept: string): Promise<string>;
}
export declare const dataciteClient: DataCiteClient;
