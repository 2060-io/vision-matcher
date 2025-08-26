/// Abstract transport interface for binary messaging

export interface Transport {
    read(n: number): Promise<Buffer>;
    write(buf: Buffer): Promise<void>;
    close(): void;
    isConnected(): boolean;
}