import { streamsActions, streamsLoad } from '$lib/server/streams';

export const load = streamsLoad('income');
export const actions = streamsActions('income');
