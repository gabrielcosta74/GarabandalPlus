
// Basic environment setup manually since we are bypassing Next.js env loading
import dotenv from 'dotenv';
dotenv.config();

// We need to handle aliases if possible, or just copy the logic for the test.
// Since we want to test the library file, we will try to import it using relative path.
// Adjust path to src/lib/reduniq/client.ts from root/scripts
import { ReduniqClient } from '../src/lib/reduniq/client';

async function main() {
    console.log('--- Starting Reduniq Verification ---');
    console.log('Checking environment variables...');
    const envStatus = {
        hasUser: !!process.env.REDUNIQ_API_USER,
        hasPass: !!process.env.REDUNIQ_API_PASSWORD,
        hasEndpoint: !!process.env.REDUNIQ_API_ENDPOINT,
    };
    console.log('Env Status:', envStatus);

    if (!envStatus.hasUser || !envStatus.hasEndpoint) {
        console.error('❌ Missing environment variables.');
        return;
    }

    const client = new ReduniqClient();
    console.log('Testing connection...');
    const result = await client.testConnection();
    console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
