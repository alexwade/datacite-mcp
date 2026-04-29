import "dotenv/config";
export declare const config: {
    readonly userAgentUrl: string;
    readonly userAgentEmail: string;
    readonly rateLimitRps: number;
    readonly cache: {
        readonly doiTtlSeconds: number;
        readonly searchTtlSeconds: number;
        readonly staticTtlSeconds: number;
    };
};
