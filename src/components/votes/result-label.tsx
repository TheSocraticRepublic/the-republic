/**
 * The words a division and a ballot are shown in, taken from the data model
 * (`voteResultEnum`, `mpBallotEnum` in src/lib/db/schema.ts).
 *
 * The outcome is neutral text: no green for carried, no red for defeated
 * (app-arms P1-9). It is a value, so it is a word in sentence case, not
 * tracked caps (Jen E2b C4). A tie displays as defeated (the plan's R-A4 rule): a tied
 * motion did not carry.
 */

export type VoteResult = 'passed' | 'defeated' | 'tie'
export type Ballot = 'yes' | 'no' | 'paired' | 'didnt_vote'

/** The one map from a stored ballot to the word shown for it. */
export const BALLOT_LABELS: Record<Ballot, string> = {
  yes: 'Yea',
  no: 'Nay',
  paired: 'Paired',
  didnt_vote: "Didn't vote",
}

/** Display order for anything grouped by ballot. */
export const BALLOT_ORDER: readonly Ballot[] = ['yes', 'no', 'paired', 'didnt_vote']

export function ballotLabel(ballot: string): string {
  // An unrecognised value is shown as stored rather than guessed at.
  return BALLOT_LABELS[ballot as Ballot] ?? ballot
}

export function resultLabelText(result: string): string {
  if (result === 'passed') return 'Passed'
  if (result === 'defeated' || result === 'tie') return 'Defeated'
  // An unrecognised value is shown as stored rather than guessed at.
  return result
}

interface ResultLabelProps {
  result: string
  /**
   * `lg` is the vote card's headline (18/28, primary ink: without colour, size
   * carries the answer, Jen E2b C2); `xs` and `2xs` sit in a list row's meta.
   */
  size?: 'lg' | 'xs' | '2xs'
}

const SIZE_CLASSES: Record<NonNullable<ResultLabelProps['size']>, string> = {
  lg: 'text-lg text-text-primary',
  xs: 'text-xs text-text-secondary',
  '2xs': 'text-2xs text-text-secondary',
}

export function ResultLabel({ result, size = 'xs' }: ResultLabelProps) {
  return (
    <span
      data-result={result}
      className={`${SIZE_CLASSES[size]} font-semibold`}
    >
      {resultLabelText(result)}
    </span>
  )
}
