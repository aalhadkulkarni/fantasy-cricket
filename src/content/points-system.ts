/**
 * The standard points system, per format.
 *
 * **Static content, not data.** Deliberately kept in the frontend rather than
 * in the `formats` node that `docs/data-model.js` (TBD3) earmarks for it: the
 * rules change rarely, and a redeploy is an acceptable cost for now. Moving it
 * into the database later changes only where this page reads it from.
 *
 * **These describe how points are awarded; they do not award them.** Points are
 * still entered per player per match by a system admin. Only the captain and
 * vice-captain multipliers are applied by the app itself.
 */

/** A points value, or a multiplier such as `×2`. */
export type PointsValue = number | string

export interface PointsRow {
  label: string
  value: PointsValue
}

/** A banded rate: strike rate for batting, economy for bowling. */
export interface PointsBand {
  title: string
  /** When it applies at all, e.g. a minimum number of balls. */
  qualifier: string
  rows: PointsRow[]
}

export interface PointsSection {
  title: 'Batting' | 'Bowling' | 'Fielding' | 'Others'
  rows: PointsRow[]
  band?: PointsBand
  notes?: string[]
}

export interface FormatPoints {
  formatId: 't20' | 'odi' | 'test'
  formatName: string
  sections: PointsSection[]
}

const CONCUSSION =
  'Any player involved in a concussion or X-Factor (AUS T20) substitution is awarded points for their performance only if they are in your fantasy team. For example, if M. Labuschagne replaces Steven Smith in a match, you get points for Labuschagne only if he is in your XI.'

const SUPER_OVER = 'Super over points are not counted.'

const IMPACT_PLAYER =
  'Any player involved in a match as an Impact Player (IPL) is awarded points for their performance only if they are in your fantasy team. For example, if Ishan Kishan replaces Rishabh Pant as an Impact Player, you get points for Kishan only if he is in your XI.'

const OTHERS: PointsRow[] = [
  { label: 'Captain multiplier', value: '×2' },
  { label: 'Vice-captain multiplier', value: '×1.5' },
  { label: 'Playing XI bonus', value: 4 },
]

export const POINTS_SYSTEM: readonly FormatPoints[] = [
  {
    formatId: 't20',
    formatName: 'T20',
    sections: [
      {
        title: 'Batting',
        rows: [
          { label: 'Runs', value: 1 },
          { label: 'Four bonus', value: 4 },
          { label: 'Six bonus', value: 6 },
          { label: '25 runs bonus', value: 4 },
          { label: '50 runs bonus', value: 8 },
          { label: '75 runs bonus', value: 12 },
          { label: '100 runs bonus', value: 16 },
          { label: 'Dismissal for a duck (excluding bowlers)', value: -2 },
        ],
        band: {
          title: 'Strike rate',
          qualifier: 'Minimum 20 runs scored or 10 balls played',
          rows: [
            { label: 'Less than 50', value: -6 },
            { label: '50 to 59.99', value: -4 },
            { label: '60 to 69.99', value: -2 },
            { label: '70 to 129.99', value: 0 },
            { label: '130 to 149.99', value: 2 },
            { label: '150 to 169.99', value: 4 },
            { label: '170 and above', value: 6 },
          ],
        },
      },
      {
        title: 'Bowling',
        rows: [
          { label: 'Dot ball bonus', value: 1 },
          { label: 'Wicket (except run-out)', value: 30 },
          { label: 'Maiden over bonus', value: 12 },
          { label: 'LBW / bowled bonus', value: 8 },
          { label: '3-wicket haul bonus', value: 4 },
          { label: '4-wicket haul bonus', value: 8 },
          { label: '5-wicket haul bonus', value: 12 },
        ],
        band: {
          title: 'Economy rate',
          qualifier: 'Minimum 2 overs bowled',
          rows: [
            { label: 'Less than 5', value: 6 },
            { label: '5.00 to 5.99', value: 4 },
            { label: '6.00 to 6.99', value: 2 },
            { label: '7.00 to 9.99', value: 0 },
            { label: '10.00 to 10.99', value: -2 },
            { label: '11.00 to 11.99', value: -4 },
            { label: '12.00 and above', value: -6 },
          ],
        },
      },
      {
        title: 'Fielding',
        rows: [
          { label: 'Catch', value: 8 },
          { label: '3 catch bonus', value: 4 },
          { label: 'Stumping', value: 12 },
          { label: 'Run-out (direct)', value: 12 },
          { label: 'Run-out (multiple players involved)', value: 6 },
        ],
      },
      {
        title: 'Others',
        rows: OTHERS,
        notes: [SUPER_OVER, CONCUSSION, IMPACT_PLAYER],
      },
    ],
  },
  {
    formatId: 'odi',
    formatName: 'ODI',
    sections: [
      {
        title: 'Batting',
        rows: [
          { label: 'Runs', value: 1 },
          { label: 'Four bonus', value: 4 },
          { label: 'Six bonus', value: 6 },
          { label: '25 runs bonus', value: 4 },
          { label: '50 runs bonus', value: 8 },
          { label: '75 runs bonus', value: 12 },
          { label: '100 runs bonus', value: 16 },
          { label: '125 runs bonus', value: 20 },
          { label: '150 runs bonus', value: 24 },
          { label: 'Dismissal for a duck (excluding bowlers)', value: -3 },
        ],
        band: {
          title: 'Strike rate',
          qualifier: 'Minimum 20 runs scored or 10 balls played',
          rows: [
            { label: 'Less than 30', value: -6 },
            { label: '30 to 39.99', value: -4 },
            { label: '40 to 49.99', value: -2 },
            { label: '50 to 99.99', value: 0 },
            { label: '100 to 119.99', value: 2 },
            { label: '120 to 139.99', value: 4 },
            { label: '140 and above', value: 6 },
          ],
        },
      },
      {
        title: 'Bowling',
        rows: [
          { label: 'Dot ball bonus (every 3 dot balls)', value: 1 },
          { label: 'Wicket (except run-out)', value: 30 },
          { label: 'Maiden over bonus', value: 4 },
          { label: 'LBW / bowled bonus', value: 8 },
          { label: '4-wicket haul bonus', value: 4 },
          { label: '5-wicket haul bonus', value: 8 },
          { label: '6-wicket haul bonus', value: 12 },
        ],
        band: {
          title: 'Economy rate',
          qualifier: 'Minimum 5 overs bowled',
          rows: [
            { label: 'Less than 2.5', value: 6 },
            { label: '2.50 to 3.49', value: 4 },
            { label: '3.50 to 4.49', value: 2 },
            { label: '4.50 to 6.99', value: 0 },
            { label: '7.00 to 7.99', value: -2 },
            { label: '8.00 to 8.99', value: -4 },
            { label: '9.00 and above', value: -6 },
          ],
        },
      },
      {
        title: 'Fielding',
        rows: [
          { label: 'Catch', value: 8 },
          { label: '3 catch bonus', value: 4 },
          { label: 'Stumping', value: 12 },
          { label: 'Run-out (direct)', value: 12 },
          { label: 'Run-out (multiple players involved)', value: 6 },
        ],
      },
      {
        title: 'Others',
        rows: OTHERS,
        notes: [SUPER_OVER, CONCUSSION],
      },
    ],
  },
  {
    formatId: 'test',
    formatName: 'Test',
    sections: [
      {
        title: 'Batting',
        rows: [
          { label: 'Runs', value: 1 },
          { label: 'Four bonus', value: 4 },
          { label: 'Six bonus', value: 6 },
          { label: '25 runs bonus', value: 4 },
          { label: '50 runs bonus', value: 8 },
          { label: '75 runs bonus', value: 12 },
          { label: '100 runs bonus', value: 16 },
          { label: '125 runs bonus', value: 20 },
          { label: '150 runs bonus', value: 24 },
          { label: 'Dismissal for a duck (excluding bowlers)', value: -4 },
        ],
      },
      {
        title: 'Bowling',
        rows: [
          { label: 'Wicket (except run-out)', value: 20 },
          { label: 'Maiden over bonus', value: 0 },
          { label: 'LBW / bowled bonus', value: 8 },
          { label: '4-wicket haul bonus', value: 4 },
          { label: '5-wicket haul bonus', value: 8 },
          { label: '6-wicket haul bonus', value: 12 },
        ],
      },
      {
        title: 'Fielding',
        rows: [
          { label: 'Catch', value: 8 },
          { label: 'Stumping', value: 12 },
          { label: 'Run-out (direct)', value: 12 },
          { label: 'Run-out (multiple players involved)', value: 6 },
        ],
      },
      {
        title: 'Others',
        rows: OTHERS,
        notes: [CONCUSSION],
      },
    ],
  },
]
