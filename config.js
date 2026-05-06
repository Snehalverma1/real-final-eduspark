const dev = process.env.NODE_ENV !== 'production';

export const wsUrl = dev ? 'ws://localhost:9002' : 'wss://your-production-url.com';
