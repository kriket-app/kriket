import { describe, expect, it } from 'vitest';
import { classifyNaiveBayes, trainNaiveBayes } from './nb';

const examples = [
	{ tokens: ['metro'], label: 'groceries' },
	{ tokens: ['sobeys'], label: 'groceries' },
	{ tokens: ['superstore', 'real', 'cdn'], label: 'groceries' },
	{ tokens: ['tim', 'hortons'], label: 'dining' },
	{ tokens: ['starbucks'], label: 'dining' },
	{ tokens: ['pizza', 'pizza'], label: 'dining' }
];

describe('Naive Bayes', () => {
	it('picks the class whose words it saw', () => {
		const model = trainNaiveBayes(examples);
		expect(classifyNaiveBayes(model, ['sobeys', 'regina'])).toEqual({
			label: 'groceries',
			known: true
		});
		expect(classifyNaiveBayes(model, ['starbucks'])).toEqual({ label: 'dining', known: true });
	});

	it('says so when it has seen none of the words', () => {
		const model = trainNaiveBayes(examples);
		expect(classifyNaiveBayes(model, ['lush', 'eaton', 'centre']).known).toBe(false);
	});

	it('smooths so an unseen word in a known memo does not zero the class', () => {
		const model = trainNaiveBayes(examples);
		expect(classifyNaiveBayes(model, ['tim', 'hortons', 'drivethru']).label).toBe('dining');
	});
});
