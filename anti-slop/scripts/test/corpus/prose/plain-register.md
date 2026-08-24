# What we changed about review

Most teams treat review as a gate at the end. It's not about the tooling, it's about
where the decision gets made, and that has been true since long before anyone shipped a
linter.

Two of our repositories have been quietly building a second habit alongside the first:
every reviewer leaves one question rather than one verdict. Decisions compound, and the
question is usually cheaper to answer in the pull request than in the incident channel
three weeks later :contentReference[oaicite:2]{index=2}.

We have not measured it well yet. Review latency dropped from 31 hours to 9 in the two
repositories that adopted it, and stayed flat in the four that did not, which is a
difference worth watching but not yet a result.
