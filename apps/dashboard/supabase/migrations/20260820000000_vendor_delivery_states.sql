-- Which states a vendor will actually ship to -- distinct from
-- stores.state (where they're based, a discovery signal only). NULL or
-- an empty array means nationwide (today's unrestricted default, so
-- every existing vendor keeps shipping everywhere with zero behavior
-- change). A populated array restricts checkout to just those states.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_states TEXT[];
