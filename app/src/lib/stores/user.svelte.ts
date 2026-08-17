export interface UserProfile {
	name: string;
	picture: string;
	about: string;
}

export const userPubkey = $state<{ value: string | null }>({ value: null });
export const userProfile = $state<{ value: UserProfile | null }>({ value: null });
