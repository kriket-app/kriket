import { describe, expect, it } from 'vitest';
import { signUp, testAgent } from '../../tests/helpers.js';

describe('/api/onboarding', () => {
	it('starts needing consent and onboarding, then records consent and completion', async () => {
		const a = testAgent();
		await signUp(a, 'onboard1@example.com');

		const initial = await a.get('/api/onboarding');
		expect(initial.status).toBe(200);
		expect(initial.body).toMatchObject({ needsConsent: true, needsOnboarding: true });

		const bad = await a.post('/api/onboarding/consent').send({ privacyAccepted: true });
		expect(bad.status).toBe(400);

		const consented = await a
			.post('/api/onboarding/consent')
			.send({ privacyAccepted: true, termsAccepted: true });
		expect(consented.status).toBe(201);
		expect(consented.body).toMatchObject({ needsConsent: false, needsOnboarding: true });
		expect(consented.body.acceptedPrivacyVersion).toBe(consented.body.currentPrivacyVersion);

		const done = await a.post('/api/onboarding/complete');
		expect(done.status).toBe(200);
		expect(done.body).toMatchObject({ needsConsent: false, needsOnboarding: false });

		const reopened = await a.post('/api/onboarding/reopen');
		expect(reopened.body).toMatchObject({ needsConsent: false, needsOnboarding: true });
	});

	it('requires auth', async () => {
		const a = testAgent();
		expect((await a.get('/api/onboarding')).status).toBe(401);
	});
});
