/**
 * Test script to demonstrate repository functionality
 * Run with: npx tsx scripts/test-repositories.ts
 */

import { createServiceContainer } from '../src/infrastructure/services/service-factory';
import { 
  organizationId, 
  periodId, 
  journalId, 
  accountId, 
  userId 
} from '../src/domain/shared/types';
import { Money } from '../src/domain/journal/value-objects/money';
import { JournalLine } from '../src/domain/journal/entities/journal-line';

async function testRepositories() {
  console.log('🧪 Testing Repository Layer...\n');

  // Get services
  const services = createServiceContainer();
  const { periodService, journalService } = services;

  // Test organization
  const orgId = organizationId('test-org-123');
  const userId1 = userId('user-123');
  const account1 = accountId('account-cash');
  const account2 = accountId('account-revenue');

  try {
    // 1. Create a period
    console.log('📅 Creating test period...');
    const periodResult = await periodService.createPeriod({
      id: periodId('period-2024-q1'),
      organizationId: orgId,
      name: '2024 Q1',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31')
    });

    if (periodResult.isFailure()) {
      console.error('❌ Failed to create period:', periodResult.error);
      return;
    }

    const period = periodResult.value;
    console.log('✅ Created period:', period.name);

    // 2. Create journal lines
    console.log('\n💰 Creating journal lines...');
    const line1 = JournalLine.create({
      journalId: journalId('journal-001'),
      accountId: account1,
      lineNumber: 1,
      description: 'Cash receipt',
      debitAmount: Money.EUR('1000.00'),
      creditAmount: Money.zero('EUR'),
      originalAmount: Money.EUR('1000.00'),
      exchangeRate: '1.0000'
    });

    const line2 = JournalLine.create({
      journalId: journalId('journal-001'),
      accountId: account2,
      lineNumber: 2,
      description: 'Revenue recognition',
      debitAmount: Money.zero('EUR'),
      creditAmount: Money.EUR('1000.00'),
      originalAmount: Money.EUR('1000.00'),
      exchangeRate: '1.0000'
    });

    if (line1.isFailure() || line2.isFailure()) {
      console.error('❌ Failed to create journal lines');
      return;
    }

    console.log('✅ Created journal lines');

    // 3. Create a draft journal
    console.log('\n📝 Creating draft journal...');
    const journalResult = await journalService.createDraftJournal({
      id: journalId('journal-001'),
      organizationId: orgId,
      periodId: period.id,
      journalNumber: 'JRN-2024-001',
      description: 'Test journal entry',
      reference: 'REF-001',
      postingDate: new Date('2024-02-15'),
      currency: 'EUR',
      lines: [line1.value, line2.value],
      createdBy: userId1
    });

    if (journalResult.isFailure()) {
      console.error('❌ Failed to create journal:', journalResult.error);
      return;
    }

    const journal = journalResult.value;
    console.log('✅ Created draft journal:', journal.journalNumber);
    console.log('   Status:', journal.status);
    console.log('   Total Debit:', journal.getTotalDebit().toString());
    console.log('   Total Credit:', journal.getTotalCredit().toString());
    console.log('   Balanced:', journal.isBalanced());

    // 4. Find the journal
    console.log('\n🔍 Finding journal by ID...');
    const foundResult = await journalService.findJournal(journal.id, orgId);
    
    if (foundResult.isFailure()) {
      console.error('❌ Failed to find journal:', foundResult.error);
      return;
    }

    if (foundResult.value) {
      console.log('✅ Found journal:', foundResult.value.journalNumber);
      console.log('   Lines count:', foundResult.value.lines.length);
    } else {
      console.log('❌ Journal not found');
    }

    // 5. Find journals by period
    console.log('\n📊 Finding journals by period...');
    const journalsResult = await journalService.findByPeriod(period.id, orgId);
    
    if (journalsResult.isFailure()) {
      console.error('❌ Failed to find journals:', journalsResult.error);
      return;
    }

    console.log(`✅ Found ${journalsResult.value.length} journals in period`);

    console.log('\n🎉 Repository tests completed successfully!');

  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }
}

// Run the test
testRepositories().catch(console.error);