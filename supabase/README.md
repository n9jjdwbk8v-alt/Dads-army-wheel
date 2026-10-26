# Supabase

The database for syncing the app between phones. Not used by the app yet.

## Setting it up

1. In the Supabase dashboard, switch on **Authentication > Sign In / Providers > Anonymous sign-ins**. Each phone
   signs in anonymously, then picks its name from the roster.
2. Run the files in `migrations/` in order: paste each into **SQL Editor** and press Run (or use `supabase db push`
   with the Supabase CLI).

## What's in it

- `teams`: the one team, and what players can do by default.
- `team_state`: the app's saved data, one JSON document per section (players, teams, history, gameday, fees), the
  same shape each phone stores today. The last save of a section wins.
- `people`: roles (admin or player), per-person permission changes, and admins' PIN hashes (never readable by
  phones).
- `sessions`: which person each signed-in phone is.

Phones read `team_state` directly; row level security only shows fees and history to people allowed to see them.
Every change goes through a function that checks permission:

| Function | Who | What |
| --- | --- | --- |
| `create_team(name, sections, admin_player_id, pin)` | first phone | Uploads its data as the team's; that person becomes the first admin |
| `list_people()` | any phone | The "Who are you?" list |
| `claim_name(player_id, pin)` | any phone | Signs the phone in as that person (admins need their PIN) |
| `sign_out()` | signed in | "Not me" |
| `whoami()` | signed in | Role and what this person can do |
| `save_section(section, data)` | by permission | Saves players (`roster`), teams and history (`split`), gameday (`gameday`), fees (`editFees`) |
| `set_here(here)` | by permission (`here`) | Ticks only your own name as here tonight |
| `people_overview()` | admin | Everyone, their role, changes and how many phones are signed in |
| `set_role(player_id, role, pin)` | admin | Make someone admin (needs a PIN) or a player; the last admin can't be removed |
| `set_permissions(player_id, permissions)` | admin | Per-person changes, e.g. `{"seeFees": true}`; `{}` resets |
| `set_default_permissions(permissions)` | admin | What players can do by default |
| `set_pin(player_id, pin)` | admin | Reset an admin's PIN |
| `sign_out_person(player_id)` | admin | Sign someone out of all their phones |

Permissions: `here`, `roster`, `split`, `seeFees`, `editFees`, `gameday`, `history`.
