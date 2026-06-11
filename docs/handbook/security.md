# Users, Roles and Security

## Users

User authentication currently supports:

- Registration via email/password
- Login via email/password
- Login via Google
- Login via Facebook
- Session refresh
- Logout
- `me` endpoint

`AccessToken` is currently a string representation of the session identifier.

## Roles

The database contains the following tables:

- `roles`
- `user_roles`

The following roles are pre-seeded:

- `admin`
- `user`
- `moderator`
- `editor`
- `support`
- `viewer`

## Role Assignment

`user_roles` is a many-to-many relationship between a user and a role.

This approach allows you to:

- Assign multiple roles to a single user
- Change permissions without altering the users table
- Add new roles without migrating the users table

## Internal API

A separate protection layer exists only for `/internal/*` routes.

It requires the following header:

- `X-Internal-Api-Key`

If the key is missing or incorrect, the request returns `401 Unauthorized`.

## Future Security Extensions

Currently:

- Role-based authorization in public APIs is not yet centralized
- `api/prompts` exists as a CRUD layer but is not restricted by role middleware

This is an intentional step in scaffolding, not the final security model.

