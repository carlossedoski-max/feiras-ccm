<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Equipment planning
- Keep equipment business calculations and spreadsheet parsing in `src/lib/equipment/model.ts`, separate from the existing fairs store, so changes do not affect legacy modules.
- Use authenticated equipment queries with their own cache key and paginated reads, so large imported catalogs are not truncated by the Data API.
- Import spreadsheets and copy editions through atomic security-invoker database functions, so partial writes cannot leave inconsistent lists or alter the source edition.
- Fetch official specifications through an authenticated server function and a replaceable server-only adapter, so product retrieval never runs in the user's browser.
- Keep the equipment detail route unnested from its content index; use the trailing-underscore filename so each screen renders independently.
- Positions and rotations are stored for a future 2D layout; do not expose an unimplemented floorplan control.
