import { z } from 'zod';
import { registry } from '../openapi/registry.js';

// Bump these when the legal texts change; users who accepted an older version
// are asked again. Keep frontend/src/lib/legal/versions.ts in sync.
export const PRIVACY_VERSION = '2026-09-27';
export const TERMS_VERSION = '2026-09-27';

export const OnboardingStatus = registry.register(
	'OnboardingStatus',
	z.object({
		needsConsent: z.boolean(),
		needsOnboarding: z.boolean(),
		currentPrivacyVersion: z.string(),
		currentTermsVersion: z.string(),
		acceptedPrivacyVersion: z.string().nullable(),
		acceptedTermsVersion: z.string().nullable(),
		onboardingCompletedAt: z.string().nullable().openapi({ format: 'date-time' })
	})
);
export type OnboardingStatusDto = z.infer<typeof OnboardingStatus>;

export const ConsentBody = registry.register(
	'ConsentBody',
	z.object({
		privacyAccepted: z.literal(true, {
			message: 'Please accept the privacy statement to continue.'
		}),
		termsAccepted: z.literal(true, {
			message: 'Please accept the terms of use to continue.'
		})
	})
);
export type ConsentInput = z.infer<typeof ConsentBody>;
