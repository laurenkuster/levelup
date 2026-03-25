/**
 * savedPlanService.js
 *
 * CRUD operations for coach-generated plans (workout routines, stretch
 * routines, meal plans). Persisted to AsyncStorage + Firestore.
 */

import { saveData, loadData, SYNC_DOCS } from './firestoreSync';

const LOCAL_KEY = 'levelup_saved_plans_v1';

/**
 * Save a new plan.
 * @param {{ type: string, title: string, items: Array }} plan
 */
export async function savePlan(plan) {
  const plans = await loadPlans();
  const newPlan = {
    ...plan,
    id: `plan_${Date.now()}`,
    createdAt: new Date().toISOString(),
    items: (plan.items || []).map((item) => ({ ...item, logged: false })),
  };
  plans.unshift(newPlan);
  await saveData(LOCAL_KEY, SYNC_DOCS.SAVED_PLANS, plans);
  return newPlan;
}

/** Load all saved plans. */
export async function loadPlans() {
  const data = await loadData(LOCAL_KEY, SYNC_DOCS.SAVED_PLANS);
  return data || [];
}

/** Delete a plan by ID. */
export async function deletePlan(planId) {
  const plans = await loadPlans();
  const filtered = plans.filter((p) => p.id !== planId);
  await saveData(LOCAL_KEY, SYNC_DOCS.SAVED_PLANS, filtered);
}

/** Update a plan (e.g. mark items logged). */
export async function updatePlan(planId, updates) {
  const plans = await loadPlans();
  const idx = plans.findIndex((p) => p.id === planId);
  if (idx === -1) return null;
  plans[idx] = { ...plans[idx], ...updates };
  await saveData(LOCAL_KEY, SYNC_DOCS.SAVED_PLANS, plans);
  return plans[idx];
}
