<script lang="ts">
	import { toast } from '$lib/toast';

	let { inviteToken, onClose }: { inviteToken: string; onClose: () => void } = $props();
	
	const inviteLink = $derived(typeof window !== 'undefined' ? `${window.location.origin}/join/${inviteToken}` : '');

	function copyToClipboard() {
		navigator.clipboard.writeText(inviteLink);
		toast.success('Invite link copied to clipboard');
	}

	function copyCode() {
		navigator.clipboard.writeText(inviteToken);
		toast.success('Invite code copied to clipboard');
	}
</script>

<div class="modal-backdrop" onclick={onClose} role="presentation">
	<div class="modal-content" onclick={e => e.stopPropagation()} role="presentation">
		<header>
			<h2>Invite to Group</h2>
			<button class="close-btn" onclick={onClose}>&times;</button>
		</header>

		<div class="modal-body">
			<div class="info-box">
				<span class="emoji">ℹ️</span>
				<p>Anyone with the link can join and see expense history.</p>
			</div>

			<p>Share this link with friends to invite them to this group.</p>
			
			<div class="link-container">
				<input type="text" readonly value={inviteLink} />
				<button class="btn btn-primary" onclick={copyToClipboard}>Copy</button>
			</div>

			<div class="token-display">
				<span class="label">Invite Code:</span>
				<button class="token-btn" onclick={copyCode} title="Click to copy code">
					<code class="token">{inviteToken}</code>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
				</button>
			</div>
		</div>

		<footer>
			<button class="btn btn-secondary" onclick={onClose}>Close</button>
		</footer>
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal-content {
		background: white;
		border-radius: 12px;
		width: 90%;
		max-width: 450px;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	header {
		padding: 1.25rem;
		border-bottom: 1px solid #e5e7eb;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: #111827;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		color: #9ca3af;
		cursor: pointer;
	}

	.modal-body {
		padding: 1.25rem;
	}

	.info-box {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		background: #fffbeb;
		border: 1px solid #fcd34d;
		padding: 0.75rem;
		border-radius: 6px;
		margin-bottom: 1rem;
		color: #92400e;
		font-size: 0.9rem;
	}

	.info-box p {
		margin: 0;
		line-height: 1.4;
	}

	.info-box .emoji {
		font-size: 1.1rem;
		line-height: 1;
		flex-shrink: 0;
	}

	.link-container {
		display: flex;
		gap: 0.5rem;
		margin: 1rem 0;
	}

	.link-container input {
		flex: 1;
		padding: 0.625rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		background: #f9fafb;
		font-size: 0.875rem;
		color: #374151;
	}

	.token-display {
		margin-top: 1.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: #6b7280;
	}

	.token-btn {
		background: #f3f4f6;
		border: 1px solid transparent;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		transition: all 0.2s;
		color: #374151;
	}

	.token-btn:hover {
		background: #e5e7eb;
		border-color: #d1d5db;
	}

	.token {
		font-family: monospace;
		font-weight: 600;
		color: #111827;
	}

	footer {
		padding: 1.25rem;
		border-top: 1px solid #e5e7eb;
		display: flex;
		justify-content: flex-end;
	}

	.btn {
		padding: 0.625rem 1.25rem;
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
		border: 1px solid transparent;
	}

	.btn-secondary {
		background: white;
		border-color: #d1d5db;
		color: #374151;
	}

	.btn-primary {
		background: #2563eb;
		color: white;
	}
</style>
