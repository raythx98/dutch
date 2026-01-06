# AI Context

This file provides persistent context and instructions for AI interactions in this project.

## Project Overview

- **Name:** dutch
- **Description:** Alternative to Splitwise

## Tech Stack

- **Frontend:** SvelteKit (TypeScript)
- **Storage:** IndexedDB
- **Deployment:** Static GH Pages
- **Backend:** GraphQL which is run separately on AWS

## Coding Standards & Preferences

- Follow Svelte best practices.
- Use TypeScript for all new components and logic.

## Context & Rules

- base URL is `http://localhost:8080/query`, which is different in production. Backend api contract is provided via `schema.graphql`
- GraphQL auth is done using bearer/JWT auth, this is obtained via the `register` and `login` mutations
- Keep the solution lightweight, reduce the number of dependencies needed
- This is how an error response looks like, code and message is most relevant

```json
{
	"errors": [
		{
			"message": "Unauthorized",
			"path": ["groups"],
			"extensions": {
				"code": 401
			}
		}
	],
	"data": null
}
```
