import Redis from "ioredis";


console.log(process.env.REDIS_DATABASE_URI!, 'TEST')

const redis = new Redis(process.env.REDIS_DATABASE_URI!);

export default redis;
