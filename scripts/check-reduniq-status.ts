// Check Reduniq status for a specific orderRef and/or token.
// Usage: npx tsx scripts/check-reduniq-status.ts <orderRef> [token]
import dotenv from 'dotenv';
dotenv.config();
import { ReduniqClient } from '../src/lib/reduniq/client';

async function main() {
    const [orderRef, tokenArg] = process.argv.slice(2);
    if (!orderRef) {
        console.error('Usage: tsx scripts/check-reduniq-status.ts <orderRef> [token]');
        process.exit(1);
    }

    const client = new ReduniqClient();

    console.log(`\n=== searchTransactions orderRef=${orderRef} ===`);
    const search = await client.searchTransactions({ orderRef, limit: 25 });
    console.log('ok:', search.ok, 'status:', search.status);
    console.log(JSON.stringify(search.data, null, 2));

    if (tokenArg) {
        console.log(`\n=== getResult token=${tokenArg} ===`);
        const getRes = await client.getResult(tokenArg);
        console.log('ok:', getRes.ok, 'status:', getRes.status);
        console.log(JSON.stringify(getRes.data, null, 2));

        console.log(`\n=== getOrderStatus (normalized) ===`);
        const norm = await client.getOrderStatus(tokenArg);
        console.log(JSON.stringify(norm, null, 2));
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
