import parse from "url-parse";
import Redis from "ioredis";

const redis_uri = parse(String(process.env.HEROKU_REDIS_URL));
const redisOptions = String(process.env.HEROKU_REDIS_URL).includes("rediss://")
    ? {
        port: Number(redis_uri.port),
        host: redis_uri.hostname,
        password: redis_uri.auth.split(":")[1],
        db: 0,
        tls: {
            rejectUnauthorized: false,
        },
    }
    : process.env.HEROKU_REDIS_URL;

//@ts-ignore
export let redisConnection = new Redis(redisOptions);
