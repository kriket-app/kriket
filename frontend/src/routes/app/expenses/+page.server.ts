import { streamsActions, streamsLoad } from '$lib/server/streams';

export const load = streamsLoad('expense');
export const actions = streamsActions('expense');
