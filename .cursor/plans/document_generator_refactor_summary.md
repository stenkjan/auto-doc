# Document Generator Refactoring Summary

## Analysis Complete — Key Redundancies Found

### 1. INPUT TEMPLATE DUPLICATION (3 occurrences → consolidate to 1)
- **Current**: Template appears in Schnellstart (lines 15-44), INPUT-TEMPLATE section (lines 103-123), and referenced again in Phase 1
- **Fix**: Keep only ONE template in Schnellstart section. Remove section "INPUT-TEMPLATE FÜR DEN NUTZER" entirely. Phase 1 references it, doesn't redefine it.

### 2. DOCUMENT STRUCTURE/OUTLINE DUPLICATION (3 occurrences → consolidate to 1)
- **Current**:
  - Phase 1.2: Agent outputs document summary with sections
  - Phase 3.1: Defines page structure again ("Seite 1: Deckblatt...")
  - Phase 4: Implements structure
- **Fix**: Phase 1 extracts and confirms structure. Phase 3 validates it. Phase 4 implements. No re-definition in Phase 3.

### 3. QUALITY CHECKS DUPLICATION (2 separate sections → merge)
- **Current**:
  - Phase 4.9 (lines 866-948): QA gate before PDF delivery
  - QUALITÄTS-CHECKLISTE (lines 1299-1359): Separate final checklist
- **Fix**: Merge both into a single "PHASE 4.9 — QUALITY GATE" section with all checks consolidated.

### 4. CSS DUPLICATION (redundant descriptions)
- **Current**:
  - Section 4.2: Describes HTML structure with comment `[VOLLSTÄNDIGES CSS — SIEHE ABSCHNITT 4.3]`
  - Section 4.3: Full 250-line CSS block
  - CSS comments internally repeat @page rules 3 times
- **Fix**: Keep 4.3 as-is. In 4.2, just reference it (already done). Remove duplicate @page comments in CSS — show once with all variants commented.

### 5. DESIGN REASONING REDUNDANCY
- **Current**:
  - Phase 3.5 asks: "Which margins? → Standard 16mm / luftig 20mm / dicht 14mm"
  - CSS in 4.3 repeats the same decision in comments (lines 470-476)
- **Fix**: Phase 3.5 outputs a design decision protocol. CSS comments reference it ("See Phase 3.5 decision"), don't repeat the logic.

### 6. FOOTER TEMPLATE DUPLICATION (3 occurrences → reference only)
- **Current**:
  - Section 4.4 (Deckblatt): Shows footer inline
  - Section 4.5 (Inhaltsseiten): Shows footer inline
  - Section 4.7: Defines footer template
- **Fix**: Section 4.7 is the ONE source of truth. Sections 4.4 and 4.5 write `[FOOTER — SIEHE 4.7]` instead of inline code.

---

## Proposed New Structure (Streamlined)

```
SCHNELLSTART (combines input template + quick guide)
├─ Single USER INPUT template here
└─ 4-step guide (unchanged)

IDENTITÄT & ZWECK (unchanged)

PHASE 1 — PARSE & KONGRUENZ
├─ 1.1 Extraction (references Schnellstart template)
├─ 1.2 Summary card output (ONE source of document outline)
├─ 1.3 Max 3 questions
└─ 1.4 Wait for confirmation

PHASE 2 — CONTENT-EXTRAKTION (unchanged, already tight)

PHASE 3 — STRUKTUR & DESIGN
├─ 3.1 Validate structure from Phase 1 (don't redefine)
├─ 3.2 Design reasoning (merged from old "Phase 3.5")
│   ├─ Dokumenttyp → Stil-Profil
│   ├─ CSS values (margins, colors, font-size)
│   └─ Component activation
└─ 3.3 Output design decision protocol

PHASE 4 — HTML-GENERIERUNG
├─ 4.1 Output path
├─ 4.2 HTML structure (minimal — references 4.3 for CSS)
├─ 4.3 COMPLETE CSS (single source of truth)
├─ 4.4 Deckblatt template (references 4.7 for footer)
├─ 4.5 Inhaltsseiten template (references 4.7 for footer)
├─ 4.6 Tabellen template
├─ 4.7 Footer template (ONE definition)
└─ 4.8 Formatting rules

PHASE 4.9 — QUALITY GATE (merged QA)
├─ Rechtschreibung
├─ Terminologie
├─ Quellenkonformität
├─ Zahlen-Kreuzprüfung
├─ Design checklist (merged from old QUALITÄTS-CHECKLISTE)
└─ QA protocol output

PHASE 5 — PDF DELIVERY (unchanged)

PHASE 6 — AMENDMENT MODE (unchanged)

DESIGN CHEAT-SHEET (unchanged — useful quick reference)
```

---

## Changes Summary

**Removed sections:**
1. "INPUT-TEMPLATE FÜR DEN NUTZER" (lines 99-123) — consolidated into Schnellstart
2. Separate "QUALITÄTS-CHECKLISTE" (lines 1299-1359) — merged into Phase 4.9
3. "Phase 3.5" as standalone — merged into Phase 3 as "3.2 Design Reasoning"

**Consolidated sections:**
1. Phase 3 now includes design reasoning inline (not separate phase)
2. Phase 4.9 now includes ALL quality checks (spelling + design + sources + numbers)
3. Footer template defined once in 4.7, referenced in 4.4/4.5

**Estimated size reduction:**
- Original: 1381 lines
- Refactored: ~950 lines (30% reduction)

---

## Next Steps

To apply this refactoring:
1. Create new file: `.cursor/plans/document_generator_standalone_v2.md`
2. Implement structure above
3. Test with one generation to ensure nothing broken
4. Replace old file once verified

---

**Ready to proceed with full refactored version?** (This summary ensures no functionality is lost)
