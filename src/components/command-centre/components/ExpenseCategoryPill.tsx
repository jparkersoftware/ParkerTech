import { EXPENSE_CATEGORY_LABEL, type ExpenseCategory } from '../lib/types';

const VARIANT: Record<ExpenseCategory, string> = {
  travel: 'is-travel',
  subscriptions: 'is-subscriptions',
  equipment: 'is-equipment',
  software: 'is-software',
  office: 'is-office',
  'professional-services': 'is-professional-services',
  marketing: 'is-marketing',
  other: 'is-other',
};

export default function ExpenseCategoryPill({
  category,
}: {
  category: ExpenseCategory;
}) {
  return (
    <span className={`cc-expense-pill ${VARIANT[category]}`}>
      {EXPENSE_CATEGORY_LABEL[category]}
    </span>
  );
}
