import { matchesFilter, applyUpdate } from '../src/db/mysql.js';

function runTests() {
  console.log('Testing matchesFilter and applyUpdate...');

  // 1. Exact match
  const doc1 = { _id: '123', status: 'pending', attempts: 0, runAt: new Date(Date.now() - 5000) };
  if (!matchesFilter(doc1, { status: 'pending' })) throw new Error('Exact match failed');
  if (matchesFilter(doc1, { status: 'completed' })) throw new Error('Mismatch failed');

  // 2. $lte comparison with Date
  if (!matchesFilter(doc1, { runAt: { $lte: new Date() } })) throw new Error('$lte Date comparison failed');

  // 3. $or
  if (!matchesFilter(doc1, { $or: [{ guid: 'abc' }, { _id: '123' }] })) throw new Error('$or failed');

  // 4. $ne
  if (!matchesFilter(doc1, { status: { $ne: 'published' } })) throw new Error('$ne failed');
  if (matchesFilter(doc1, { status: { $ne: 'pending' } })) throw new Error('$ne negative failed');

  // 5. $in
  if (!matchesFilter(doc1, { status: { $in: ['pending', 'processing'] } })) throw new Error('$in failed');

  // 6. applyUpdate $set and $inc
  const doc2: any = { _id: '456', status: 'pending', attempts: 1 };
  applyUpdate(doc2, { $set: { status: 'processing' }, $inc: { attempts: 1 } });
  if (doc2.status !== 'processing' || doc2.attempts !== 2) throw new Error('applyUpdate failed');

  console.log('All MySQL adapter in-memory logic tests passed successfully!');
}

runTests();

