import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userOnboarding } from '../db/tables.js';
import { PRIVACY_VERSION, TERMS_VERSION, type OnboardingStatusDto } from '../schemas/onboarding.js';

const iso = (d: Date | null) => d?.toISOString() ?? null;

export async function getOnboardingStatus(userId: string): Promise<OnboardingStatusDto> {
	const [row] = await db.select().from(userOnboarding).where(eq(userOnboarding.userId, userId));
	const needsConsent =
		!row || row.privacyVersion !== PRIVACY_VERSION || row.termsVersion !== TERMS_VERSION;
	return {
		needsConsent,
		needsOnboarding: !row?.onboardingCompletedAt,
		currentPrivacyVersion: PRIVACY_VERSION,
		currentTermsVersion: TERMS_VERSION,
		acceptedPrivacyVersion: row?.privacyVersion ?? null,
		acceptedTermsVersion: row?.termsVersion ?? null,
		onboardingCompletedAt: iso(row?.onboardingCompletedAt ?? null)
	};
}

async function upsert(userId: string, patch: Partial<typeof userOnboarding.$inferInsert>) {
	const [row] = await db
		.insert(userOnboarding)
		.values({ userId, ...patch })
		.onConflictDoUpdate({ target: userOnboarding.userId, set: { ...patch, updatedAt: new Date() } })
		.returning();
	return row;
}

/** Records acceptance of the current privacy + terms versions. */
export async function acceptConsent(userId: string): Promise<OnboardingStatusDto> {
	const now = new Date();
	await upsert(userId, {
		privacyVersion: PRIVACY_VERSION,
		termsVersion: TERMS_VERSION,
		privacyAcceptedAt: now,
		termsAcceptedAt: now
	});
	return getOnboardingStatus(userId);
}

/** Marks the walkthrough done. Consent must already be recorded. */
export async function completeOnboarding(userId: string): Promise<OnboardingStatusDto> {
	await upsert(userId, { onboardingCompletedAt: new Date() });
	return getOnboardingStatus(userId);
}

/** Clears completion so settings can replay the walkthrough. Consent stays. */
export async function reopenOnboarding(userId: string): Promise<OnboardingStatusDto> {
	await upsert(userId, { onboardingCompletedAt: null });
	return getOnboardingStatus(userId);
}
