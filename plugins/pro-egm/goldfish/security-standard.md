# Standard for the security and compliance goldfish

A finding names a concrete attack, leak or audit question.
"Consider security" is not a finding.

## Blocker

Sensitive data with no stated storage, access or retention rule.
A trust boundary where an outside input reaches a decision or a store with no stated check.
A safeguard that fails open with no stated reason.
A regulated domain with no rule named.

## Major

An access rule implied by a join or a data model instead of stated.
A named regulation or contract with no part and no owner who confirms it.
Data kept longer than the brief's purpose needs, with no reason.

## Nit

A sensitive data kind named but not classified.
Report at most five Nits.

## Not a finding

Implementation detail such as cipher suites or library versions, which belongs in the design doc.
A risk the brief names, weighs and accepts with a reason.
