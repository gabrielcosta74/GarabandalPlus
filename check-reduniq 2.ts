import { reduniqClient } from './src/lib/reduniq/client';

async function check() {
    const token = '8efafd450ddd51db87ed6271beec1d53db6aeee3';
    console.log('Checking token:', token);
    try {
        const result = await reduniqClient.getResult(token);
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error(err);
    }
}

check();
