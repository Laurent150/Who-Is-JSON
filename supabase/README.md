# Supabase account backend

This directory contains the retained Supabase backend: database migrations,
account isolation checks, and the earlier AI trial function. The current FIMI
desktop release uses the CloudBase email account and trial integration in
[`cloudbase/`](../cloudbase/).

Keep these files for existing Supabase installations and migration reference.
They are not required to install the current desktop release. Do not apply the
SQL checks or deploy the function to a production project without reviewing
the target environment and its existing data.

For application setup, start with the [project README](../README.md).
