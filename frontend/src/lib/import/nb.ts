/** A multinomial Naive Bayes model over word counts, with add-one (Laplace) smoothing. */
export type NbModel = {
	classes: string[];
	logPrior: Record<string, number>;
	/** log P(word | class) for words seen in that class. */
	logLikelihood: Record<string, Record<string, number>>;
	/** log P(word | class) for a word never seen in that class. */
	logUnseen: Record<string, number>;
	vocabulary: Set<string>;
};

export function trainNaiveBayes(examples: { tokens: string[]; label: string }[]): NbModel {
	const counts: Record<string, Record<string, number>> = {};
	const docs: Record<string, number> = {};
	const vocabulary = new Set<string>();
	for (const { tokens, label } of examples) {
		docs[label] = (docs[label] ?? 0) + 1;
		counts[label] ??= {};
		for (const t of tokens) {
			counts[label][t] = (counts[label][t] ?? 0) + 1;
			vocabulary.add(t);
		}
	}
	const classes = Object.keys(docs);
	const total = examples.length;
	const model: NbModel = { classes, logPrior: {}, logLikelihood: {}, logUnseen: {}, vocabulary };
	for (const c of classes) {
		const words = counts[c];
		const wordTotal = Object.values(words).reduce((s, n) => s + n, 0);
		model.logPrior[c] = Math.log(docs[c] / total);
		model.logLikelihood[c] = {};
		for (const [w, n] of Object.entries(words)) {
			model.logLikelihood[c][w] = Math.log((n + 1) / (wordTotal + vocabulary.size));
		}
		model.logUnseen[c] = Math.log(1 / (wordTotal + vocabulary.size));
	}
	return model;
}

/** The most likely class; `known` is false when no token was in the training vocabulary. */
export function classifyNaiveBayes(model: NbModel, tokens: string[]) {
	const known = tokens.some((t) => model.vocabulary.has(t));
	let best = model.classes[0];
	let bestScore = -Infinity;
	for (const c of model.classes) {
		let score = model.logPrior[c];
		for (const t of tokens) score += model.logLikelihood[c][t] ?? model.logUnseen[c];
		if (score > bestScore) {
			bestScore = score;
			best = c;
		}
	}
	return { label: best, known };
}
