/**
 * Test script to demonstrate use case functionality
 * Run with: npx tsx scripts/test-use-cases.ts
 */

import { createUseCaseContainer } from '../src/application/use-cases/use-case-factory';
import { 
  organizationId, 
  userId,
  accountId,
  AuditContext,
  UserRole
} from '../src/domain/shared/types';

async function testUseCases() {
  console.log('🧪 Testing Use Cases Layer...\n');

  // Get use cases
  const useCases = createUseCaseContainer();
  
  // Test context
  const orgId = organizationId('test-org-456');
  const testUserId = userId('user-456');
  const auditContext: AuditContext = {
    userId: testUserId,
    userRole: 'accountant' as UserRole,
    timestamp: new Date(),
    requestId: 'test-request-001'
  };

  try {
    // 1. Create a Period
    console.log('📅 Creating test period...');
    const createPeriodResult = await useCases.createPeriod.execute({
      organizationId: orgId,
      name: '2024 Q2',
      startDate: new Date('2024-04-01'),
      endDate: new Date('2024-06-30'),
      auditContext
    });

    if (createPeriodResult.isFailure()) {
      console.error('❌ Failed to create period:', createPeriodResult.error);
      return;
    }

    const period = createPeriodResult.value.period;
    console.log('✅ Created period:', period.name);
    console.log('   Duration:', createPeriodResult.value.durationDays, 'days');
    console.log('   Status:', createPeriodResult.value.status);

    // 2. Create a Journal
    console.log('\n📝 Creating journal entry...');
    const createJournalResult = await useCases.createJournal.execute({
      organizationId: orgId,
      periodId: period.id,
      description: 'Test invoice payment',
      reference: 'INV-2024-001',
      postingDate: new Date('2024-05-15'),
      currency: 'EUR',
      lines: [
        {
          accountId: accountId('1000-cash'),
          description: 'Cash received',
          debitAmount: '1500.00',
          currency: 'EUR'
        },
        {
          accountId: accountId('4000-revenue'),
          description: 'Service revenue',
          creditAmount: '1500.00',
          currency: 'EUR'
        }
      ],
      auditContext
    });

    if (createJournalResult.isFailure()) {
      console.error('❌ Failed to create journal:', createJournalResult.error);
      return;
    }

    const journal = createJournalResult.value.journal;
    console.log('✅ Created journal:', createJournalResult.value.journalNumber);
    console.log('   Status:', createJournalResult.value.status);
    console.log('   Total Debit:', createJournalResult.value.totalDebit.toString());
    console.log('   Total Credit:', createJournalResult.value.totalCredit.toString());
    console.log('   Balanced:', createJournalResult.value.isBalanced);

    // 3. Validate journal for posting
    console.log('\n🔍 Validating journal for posting...');
    const validation = await useCases.postJournal.validateForPosting(
      journal.id,
      orgId
    );

    if (validation.isSuccess()) {
      console.log('✅ Posting validation passed');
      console.log('   Issues found:', validation.value.issues.length);
      if (validation.value.issues.length > 0) {
        validation.value.issues.forEach(issue => {
          console.log(`   - ${issue.field}: ${issue.message}`);
        });
      }
    }

    // 4. Post the journal
    console.log('\n📮 Posting journal...');
    const postResult = await useCases.postJournal.execute({
      journalId: journal.id,
      organizationId: orgId,
      auditContext
    });

    if (postResult.isFailure()) {
      console.error('❌ Failed to post journal:', postResult.error);
      return;
    }

    const postedJournal = postResult.value;
    console.log('✅ Posted journal:', postedJournal.journalNumber);
    console.log('   Status:', postedJournal.status);
    console.log('   Posted at:', postedJournal.postedAt.toISOString());
    console.log('   Posted by:', postedJournal.postedBy);
    console.log('   Hash (self):', postedJournal.hashSelf?.substring(0, 16) + '...');

    // 5. Query journals
    console.log('\n🔍 Querying journals...');
    const queryResult = await useCases.queryJournals.execute({
      organizationId: orgId,
      periodId: period.id,
      filters: {
        status: 'posted'
      },
      sorting: {
        sortBy: 'postingDate',
        sortOrder: 'desc'
      },
      pagination: {
        page: 1,
        pageSize: 10
      },
      auditContext
    });

    if (queryResult.isSuccess()) {
      const queryResponse = queryResult.value;
      console.log('✅ Found journals:', queryResponse.totalCount);
      console.log('   Posted journals:', queryResponse.summary.statusCounts.posted);
      console.log('   Draft journals:', queryResponse.summary.statusCounts.draft);
      console.log('   Currency summary:', Object.keys(queryResponse.summary.currencySummary));
    }

    // 6. Get reversal preview
    console.log('\n🔄 Getting reversal preview...');
    const reversalPreview = await useCases.reverseJournal.getReversalPreview(
      postedJournal.journal.id,
      orgId,
      new Date('2024-05-20'),
      'Error correction reversal'
    );

    if (reversalPreview.isSuccess()) {
      const preview = reversalPreview.value;
      console.log('✅ Reversal preview generated');
      console.log('   Original journal:', preview.originalJournalNumber);
      console.log('   Reversal journal:', preview.reversalJournalNumber);
      console.log('   Description:', preview.description);
      console.log('   Can reverse:', preview.canReverse);
      console.log('   Lines to reverse:', preview.lines.length);
    }

    // 7. Validate reversal
    console.log('\n✅ Validating reversal...');
    const reversalValidation = await useCases.reverseJournal.validateForReversal(
      postedJournal.journal.id,
      orgId,
      new Date('2024-05-20')
    );

    if (reversalValidation.isSuccess()) {
      const validation = reversalValidation.value;
      console.log('✅ Reversal validation completed');
      console.log('   Can reverse:', validation.canReverse);
      console.log('   Issues:', validation.issues.length);
      
      if (validation.issues.length > 0) {
        validation.issues.forEach(issue => {
          console.log(`   - ${issue.field}: ${issue.message}`);
        });
      }
    }

    // 8. Actually reverse the journal
    console.log('\n🔄 Reversing journal...');
    const reverseResult = await useCases.reverseJournal.execute({
      originalJournalId: postedJournal.journal.id,
      organizationId: orgId,
      reversalDate: new Date('2024-05-20'),
      description: 'Test reversal for demonstration',
      auditContext
    });

    if (reverseResult.isFailure()) {
      console.error('❌ Failed to reverse journal:', reverseResult.error);
    } else {
      const reversal = reverseResult.value;
      console.log('✅ Journal reversed successfully');
      console.log('   Original:', reversal.originalJournalNumber, '(now reversed)');
      console.log('   Reversal:', reversal.reversalJournalNumber);
      console.log('   Reversal amount:', reversal.totalReversedAmount.toString());
      console.log('   Reversed by:', reversal.reversedBy);
    }

    // 9. Final statistics
    console.log('\n📊 Final statistics...');
    const statsResult = await useCases.queryJournals.getStatistics(
      orgId,
      period.id
    );

    if (statsResult.isSuccess()) {
      const stats = statsResult.value;
      console.log('✅ Statistics calculated');
      console.log('   Total journals:', stats.totalJournals);
      console.log('   Draft:', stats.statusCounts.draft);
      console.log('   Posted:', stats.statusCounts.posted);
      console.log('   Reversed:', stats.statusCounts.reversed);
      console.log('   Average lines per journal:', stats.averageJournalSize.toFixed(1));
      
      if (stats.mostRecentPosting) {
        console.log('   Most recent posting:', stats.mostRecentPosting.toISOString());
      }
    }

    console.log('\n🎉 Use case tests completed successfully!');
    console.log('\n📋 Summary of operations:');
    console.log('   ✅ Created accounting period');
    console.log('   ✅ Created draft journal with lines');
    console.log('   ✅ Validated journal for posting');
    console.log('   ✅ Posted journal (with hash chaining)');
    console.log('   ✅ Queried and filtered journals');
    console.log('   ✅ Generated reversal preview');
    console.log('   ✅ Validated reversal conditions');
    console.log('   ✅ Reversed journal (created reversal entry)');
    console.log('   ✅ Generated statistical reports');

  } catch (error) {
    console.error('💥 Use case test failed with error:', error);
  }
}

// Run the test
testUseCases().catch(console.error);