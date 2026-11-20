import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, PERSIST_KEY } from '../../store/useStore';
import { migrate } from '../../store/migrations';

describe('store + seed + persistence (CP2)', () => {
  beforeEach(() => {
    useStore.getState().loadStarterData();
  });

  it('uses persist key rubenyaro:v1', () => {
    expect(PERSIST_KEY).toBe('rubenyaro:v1');
  });

  it('loads starter data from seed.json with phases, categories, costs (variants & maybe), and tasks', () => {
    const state = useStore.getState();
    expect(state.settings.rates.effective).toBe(300);
    expect(state.settings.defaultConversionMode).toBe('effective');
    expect(state.settings.phases.length).toBe(7);
    expect(state.settings.categories.length).toBe(9);
    expect(state.costs.length).toBe(10);
    expect(state.tasks.length).toBe(12);

    // Check Visa Interview sub-costs
    const visa = state.costs.find((c) => c.name === 'Visa Interview');
    expect(visa).toBeDefined();
    expect(visa?.subCosts.length).toBe(2);

    // Check Flight tickets variants
    const flights = state.costs.find((c) => c.name === 'Flight tickets');
    expect(flights).toBeDefined();
    expect(flights?.variants?.length).toBe(2);
    expect(flights?.activeVariantId).toBe(flights?.variants?.[0]?.id);

    // Check Observership maybe flag
    const obs = state.costs.find((c) => c.name === 'Observership');
    expect(obs?.maybe).toBe(true);

    // Check Research sub-costs
    const research = state.costs.find((c) => c.name === 'Research');
    expect(research?.subCosts.length).toBe(2);

    // Check task linkedCostId resolution
    const step3Task = state.tasks.find((t) => t.title === 'Register & schedule Step 3');
    const step3Cost = state.costs.find((c) => c.name === 'Step 3');
    expect(step3Task?.linkedCostId).toBe(step3Cost?.id);
  });

  it('supports CRUD for accounts, transactions, costs, subCosts, and tasks', () => {
    const s = useStore.getState();

    const acc = s.addAccount({
      name: 'Main Bank',
      kind: 'bank',
      currency: 'PKR',
      openingBalance: 4_800_000,
      color: '#6366F1',
      icon: 'Wallet',
      includeInTotals: true,
    });
    expect(useStore.getState().accounts.length).toBe(1);

    s.updateAccount(acc.id, { reserved: 50_000 });
    expect(useStore.getState().accounts[0].reserved).toBe(50_000);

    const tx = s.addTransaction({
      type: 'deposit',
      date: '2026-11-18',
      accountId: acc.id,
      amount: 100_000,
      note: 'Salary',
    });
    expect(useStore.getState().transactions.length).toBe(1);

    s.updateTransaction(tx.id, { amount: 120_000 });
    expect(useStore.getState().transactions[0].amount).toBe(120_000);

    const customCost = s.addCost({
      name: 'Custom Exam',
      money: { amount: 500, currency: 'USD' },
      kind: 'fixed',
      categoryId: 'exam',
      phaseId: 'step3',
      priority: 'must',
    });
    const sub = s.addSubCost(customCost.id, {
      name: 'Late fee',
      money: { amount: 50, currency: 'USD' },
      kind: 'fixed',
      maybe: true,
    });
    expect(sub?.maybe).toBe(true);

    const updatedCost = useStore.getState().costs.find((c) => c.id === customCost.id);
    expect(updatedCost?.subCosts.length).toBe(1);

    s.deleteSubCost(customCost.id, sub!.id);
    expect(
      useStore.getState().costs.find((c) => c.id === customCost.id)?.subCosts.length
    ).toBe(0);

    s.deleteCost(customCost.id);
    s.deleteTransaction(tx.id);
    s.deleteAccount(acc.id);
    expect(useStore.getState().accounts.length).toBe(0);
    expect(useStore.getState().transactions.length).toBe(0);
  });

  it('exports JSON and merges seed-format JSON via importJSON', () => {
    const s = useStore.getState();
    const exported = s.exportJSON();
    expect(exported.schemaVersion).toBe(5);
    expect(exported.costs.length).toBe(10);

    const mergeResult = s.importJSON(
      {
        accounts: [
          {
            name: 'Savings PKR',
            kind: 'bank',
            currency: 'PKR',
            openingBalance: 4800000,
          },
        ],
        costs: [
          {
            name: 'Extra Loan',
            phase: 'obligations',
            category: 'loans',
            money: { amount: 220000, currency: 'PKR' },
          },
        ],
      },
      'merge'
    );

    expect(mergeResult.ok).toBe(true);
    expect(useStore.getState().accounts.length).toBe(1);
    expect(useStore.getState().accounts[0].openingBalance).toBe(4800000);
    expect(useStore.getState().costs.length).toBe(11);
  });

  it('merge import adds new categories without dropping existing ones, and carries an inheritance plan', () => {
    const before = useStore.getState().settings.categories.length;
    const res = useStore.getState().importJSON(
      {
        categories: [{ key: 'hobby', name: 'Hobby', color: '#000000', icon: 'Package' }],
        costs: [{ name: 'Synthetic gadget', category: 'hobby', money: { amount: 10, currency: 'USD' } }],
        inheritance: {
          total: 1000, deductions: [], heirs: [], installments: [], loans: [], allocations: [],
          unit: 'pkr', updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      'merge'
    );
    expect(res.ok).toBe(true);
    const s = useStore.getState();
    expect(s.settings.categories.length).toBe(before + 1);
    expect(s.costs.find((c) => c.name === 'Synthetic gadget')?.categoryId).toBe('hobby');
    expect(s.inheritance?.total).toBe(1000);
    expect(s.exportJSON().inheritance?.total).toBe(1000);
  });

  it('migrates partial or older persisted state cleanly', () => {
    const migrated = migrate({ costs: [{ id: 'c1', name: 'Test', money: { amount: 10, currency: 'USD' }, kind: 'fixed', categoryId: 'exam', phaseId: 'step3', priority: 'must', subCosts: [] }] }, 0);
    expect(migrated.settings.schemaVersion).toBe(5);
    expect(migrated.inheritance).toBeNull();
    expect(migrated.costs[0].maybe).toBe(false);
    expect(migrated.costs[0].included).toBe(true);
  });
});
