import { auth } from './auth';
import { toast } from './toast';
import { get } from 'svelte/store';
import { goto } from '$app/navigation';

import { base } from '$app/paths';
import { dev } from '$app/environment';

const API_URL = dev ? 'http://localhost:8080/query' : 'https://161.118.239.148.sslip.io/query';

export async function query<T>(
	queryString: string,
	variables: Record<string, unknown> = {}
): Promise<T | null> {
	const { token } = get(auth);

	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};

	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	try {
		const response = await fetch(API_URL, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				query: queryString,
				variables
			})
		});

		if (response.status === 401) {
			auth.logout();
			toast.error('Session expired. Please log in again.');
			goto(`${base}/login`);
			return null;
		}

		if (response.status === 429) {
			toast.error('Too many requests. Please slow down.');
			return null;
		}

		const result = await response.json();

		if (result.errors) {
			const message = result.errors[0]?.message || 'An unknown error occurred';
			toast.error(message);
			return null;
		}

		return result.data as T;
	} catch (error) {
		console.error('API Error:', error);
		toast.error('Connection error. Please try again later.');
		return null;
	}
}
