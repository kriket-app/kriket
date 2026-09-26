export class NotFoundError extends Error {
	constructor(what = 'Not found') {
		super(what);
		this.name = 'NotFoundError';
	}
}
export class InvalidInputError extends Error {
	constructor(
		message: string,
		public details: { path: string; message: string }[]
	) {
		super(message);
		this.name = 'InvalidInputError';
	}
}
