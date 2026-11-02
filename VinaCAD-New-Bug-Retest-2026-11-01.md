# Retest wave 2026-11-01 — BUG-87 to BUG-125

## Trạng thái phiên

Browser CAD stopped responding during the first DOM/screenshot read in this wave. Per the browser control recovery rule, no further UI input was sent after one recovery attempt. The entries below therefore distinguish existing independent evidence from source-only claims and from claims that still need a clean VinaCAD/AutoCAD Web replay.

## Existing independent evidence carried forward

- BUG-12: View direction/ViewCube/UCS mismatch was independently observed.
- BUG-82 subset: Layout Plot failure was independently reproduced on VinaCAD; AutoCAD Web opened the Plot dialog.
- BUG-01, BUG-02, BUG-09: not independently reproduced in the earlier clean Osnap tests.
- PURGE/-PURGE: parity with AutoCAD Web was observed.
- BEDIT: VinaCAD chooser vs AutoCAD Web Unsupported; this is a desktop/web scope difference.
- Command-level probes from the previous wave confirmed prompt presence for MOVE, COPY, ROTATE, SCALE, CHAMFER, FILLET, OFFSET, ARC, SPLINE, PEDIT, XLINE, TEXT, MTEXT, ARRAY, TRIM, EXTEND, -VIEW, ZOOM, UCS-related UI, AREA, MEASURE and FINDINCLUDE. Prompt presence alone does not confirm the claimed geometry/state bugs.

## Retest matrix for new claims

| BUG | Command/area | Claim to replay | Status on 2026-11-01 |
|---|---|---|---|
| BUG-87 | MOVE default displacement | Press Enter at base point/default displacement and verify crash or null vector | Pending clean browser replay |
| BUG-88 | COPY second point default | Press Enter at second point and compare displacement | Pending clean browser replay |
| BUG-89 | ROTATE Reference | Use Reference option with nonzero old/new angles; verify final angle | Pending clean browser replay |
| BUG-90 | SCALE Reference | Test Reference/Points, zero input, Enter default | Pending clean browser replay |
| BUG-91 | CHAMFER | Test Polyline/Method/Undo and preserve layer/color/linetype | Pending clean browser replay |
| BUG-92 | FILLET | Test Radius/Polyline/Trim/Multiple/Undo; inspect ghost preview and console | Pending clean browser replay |
| BUG-93 | OFFSET | Test Layer=Source, Through, Enter default and resulting layer | Pending clean browser replay |
| BUG-94 | ARC | Test End keyword and all start/center/end variants | Pending clean browser replay |
| BUG-95 | SPLINE | Test Method, CV, Fit, Tolerance and Enter/Cancel transitions | Pending clean browser replay |
| BUG-96 | PEDIT | Test Reverse, Decurve and 3D polyline | Pending clean browser replay |
| BUG-97 | XLINE | Test Offset Esc and Angled/Reference | Pending clean browser replay |
| BUG-98 | TEXT/MTEXT | Test all Justify modes and MTEXT Enter at sub-prompts | Pending clean browser replay |
| BUG-99 | ARRAY | Test Rectangular/Path/Polar, Enter default and Escape cleanup | Pending clean browser replay |
| BUG-100 | TRIM/EXTEND | Test mode keyword, boundary selection, spatial refresh | Pending clean browser replay |
| BUG-101 | -VIEW/ZOOM/UCS | Test direct view keyword, Previous history depth, All/Object on negative coordinates | Pending clean browser replay |
| BUG-102 | AREA/MEASURE/FINDINCLUDE | Test Object/Area/Length keywords and polyline arc perimeter | Pending clean browser replay |
| BUG-103 | Command routing | Test aliases in command line and toolbar: HATCH→-HATCH, PURGE→-PURGE, L→LINE | Pending clean browser replay |
| BUG-104 | CIRCLE Diameter | Repeat Diameter with Enter defaults; compare radius/diameter | Pending clean browser replay |
| BUG-105 | CIRCLE TTR | Test tangent highlighting, impossible tangent, repeated cancel | Pending clean browser replay |
| BUG-106 | ELLIPSE Rotation | Test Rotation option with 2D and 3D inputs; capture console | Pending clean browser replay |
| BUG-107 | ELLIPSE Arc | Enter 0 for start/end angle; verify no loop | Pending clean browser replay |
| BUG-108 | XLINE | Test Angled/Reference/Offset with UCS rotated from WCS | Pending clean browser replay |
| BUG-109 | RECTANGLE | Test Chamfer/Elevation/Fillet/Thickness/Width/Area/Rotation and nonpositive dimensions | Pending clean browser replay |
| BUG-110 | JOIN | Test collinear lines sharing start point and 60° mismatch at low precision | Pending clean browser replay |
| BUG-111 | BREAKATPOINT | Break closed polyline and Esc cleanup; verify one open polyline vs two | Pending clean browser replay |
| BUG-112 | STRETCH/GRIP_STRETCH | Preselect, single-click, crossing window, nonzero Z and repeated grips | Pending clean browser replay |
| BUG-113 | ALIGN | Preselected entities, two-point rotation in rotated UCS, Esc cleanup | Pending clean browser replay |
| BUG-114 | MIRROR | Input 10,20,0 and test default Erase source = No | Pending clean browser replay |
| BUG-115 | -BLOCK | Existing block, press Enter at Redefine <N>, verify command ends | Pending clean browser replay |
| BUG-116 | LAYMCUR | Preselected entity and Enter with no selection; verify CLAYER/error | Pending clean browser replay |
| BUG-117 | -HATCH | ANSI31 Properties, Scale 2, angle 45, invalid pattern recovery | Pending clean browser replay |
| BUG-118 | DIMENSION/DIMLINEAR | Horizontal/Vertical Mtext keyword, circle dimension and prompt spelling | Pending clean browser replay |
| BUG-119 | ZOOM | Object/All with all-negative extents, Previous stack depth, CE keyword | Pending clean browser replay |
| BUG-120 | -VISUALSTYLE | 2D/W/H and save/restore/delete options; verify actual style change | Pending clean browser replay |
| BUG-121 | MEASURE | Angle on circle/arc, Esc preview cleanup, 90° exactness | Pending clean browser replay |
| BUG-122 | LAYOUT | Press Enter at default <Set>, New/Rename duplicate messages | Pending clean browser replay |
| BUG-123 | DIST | Multiple mode output: delta X/Y/Z, angles, high-DPI text | Pending clean browser replay |
| BUG-124 | CLEANSCREENON/JSLOAD/REGEN | Toggle idempotence, safe JS load behavior, REGEN vs REGENALL on Layout | Pending clean browser replay |
| BUG-125 | ViewCube | 6 faces/8 corners/12 edges, drag orbit, selection clear, CLI keyword language | Partial only: earlier ViewCube direction mismatch observed; edge/drag/selection/CLI subclaims pending |

## Test order for the next clean browser replay

1. Create disposable fixtures: positive and negative quadrants, two lines, circle, arc, closed polyline, text/MTEXT, block, and a Layout viewport.
2. Run default/Enter/Cancel branches first because BUG-87, 88, 90, 93, 99, 101, 104, 107, 115, 122 are state-machine claims.
3. Run geometry invariants next: CHAMFER/FILLET/OFFSET/ROTATE/SCALE/ALIGN/JOIN/BREAK/STRETCH.
4. Run annotation and measurement: TEXT/MTEXT/DIMENSION/HATCH/MEASURE/DIST.
5. Run view and ViewCube tests, then repeat the same fixture in AutoCAD Web.
6. Capture command history, visible geometry, download/PDF results, console errors and renderer heap after each group.

No BUG-87–BUG-125 entry is marked reproduced by this wave without the missing clean browser replay.

## Artifact evidence discovered while the browser was unavailable

The existing scratch artifacts contain runtime probes from the prior Phase 7/8 sessions. They are useful evidence, but they are not a fresh replay in this wave and several are source/prototype probes rather than a user-level geometry comparison. I therefore classify them separately:

| Evidence class | BUGs | Interpretation |
|---|---|---|
| Runtime probe positive in `phase7_e2e_results.json` | 87, 88, 89, 90, 101, 102 | The probe captured the claimed bad state, crash, lock or missing keyword. Re-run against a clean VinaCAD/AutoCAD pair before calling it independently confirmed. |
| Runtime probe positive in `phase8_e2e_results.json` | 103, 104, 105, 106, 107, 110, 120, 121 | The saved page-evaluation result captured registry gaps, Diameter/TTR/ELLIPSE/XLINE/JOIN failures, VISUALSTYLE stubs, and MEASURE cleanup crash. |
| Runtime probe partial | 119, 125 | ZOOM Previous stayed at length 1; the negative-extents `Number.MIN_VALUE` assertion was false in the saved probe. ViewCube is present with six 9-zone faces (54 zones) and 14 keyboard buttons, but no edge buttons; drag/selection-clear behavior was not measured. |
| Source/prototype or method inspection only | 91–100 except 101/102, 108, 109, 111–118, 122–124 | The report's logic findings are plausible and often pinpoint exact methods, but they still need a clean end-user replay and AutoCAD Web oracle. |
| Contradictory subclaim in saved probe | 92 blue ghost line, 96 3D Decurve | `phase7_e2e_results.json` reports `filletAddsBlueLineColor5ToView: false` and `decurveAbortsOn3dPolyline: false`; keep those subclaims open until a visible replay confirms them. |

Source files checked: `phase7_e2e_results.json` (2,689 bytes) and `phase8_e2e_results.json` (12,704 bytes). The master report still contains all 125 headings; a heading-count check found BUG-01 through BUG-125 exactly once each.

## Unexecuted full-option probe prepared by the other agent

`suite23_run_phase9_full_suboptions_e2e.js` exists but no `phase9_suboptions_dump.json` was produced, so it was not treated as evidence. Its planned probes cover ARRAY Path/Enter/cancel cleanup, -VISUALSTYLE handlers, -VIEW preset keywords, FINDINCLUDE/FINDMATCH keyword matching, MLEADER Enter branches, MTEXT Dynamic Column state transitions, MEASURE Angle vertex cancel, and -HATCH angle/gradient/transparency loops. These remain pending direct replay.

## Autodesk option baseline checked

- `LAYOUT` default is `<set>` and its documented options are Copy, Delete, New, Template, Rename, Saveas, Set and `?`; pressing Enter should select Set. Source: https://help.autodesk.com/cloudhelp/2025/ENG/AutoCAD-Core/files/GUID-BCE3AD90-9DE0-488C-9CA4-5FDB9401DCE0.htm
- `ELLIPSE` documents Axis Endpoint, Rotation, Arc, Center and Isocircle; Arc also has Start/End Angle, Parameter, End Parameter, Angle and Included Angle. Source: https://help.autodesk.com/cloudhelp/2022/ENU/AutoCAD-LT/files/GUID-45F9C588-2BA9-414D-8AFD-FB6B448BF273.htm
- `ARC` documents Start point, Center and End branches, including Angle, Chord length, Direction and Radius. Source: https://help.autodesk.com/cloudhelp/2022/ENU/AutoCAD-Core/files/GUID-30ECFD30-A1D6-4D60-9DD1-B487603F6772.htm
- Autodesk documents `-VISUALSTYLES` as the command-line form that exposes options; visual styles include 2D Wireframe, Wireframe, Hidden, Realistic, Shaded and others. Source: https://help.autodesk.com/cloudhelp/2018/ENU/AutoCAD-Core/files/GUID-ACA9C52C-47FC-4A21-A7BE-D692F9DA3511.htm
