# Data Forge Handoff Prompt

Use this prompt in the separate Flytothesky Data Forge project thread. Do not use it inside the OCGM implementation thread unless the task is only documentation review.

```text
우리는 Flytothesky Data Forge 플러그인의 생성 노트 frontmatter가 Obsidian Context Graph Memory(OCGM) 플러그인에서 안정적으로 읽히는지 검토한다.

중요 경계:
- 이 스레드는 Flytothesky Data Forge 프로젝트만 검토/수정한다.
- OCGM repo는 직접 수정하지 않는다.
- Data Forge runtime 호출 방식이나 Codex CLI 실행 흐름은 이번 범위가 아니다.
- credential, token, Codex login, runtime log를 노트나 export에 쓰지 않는다.

OCGM repo:
- /Users/flytothesky/Library/CloudStorage/GoogleDrive-kskileco@gmail.com/내 드라이브/Obsidian/obsidian-context-graph-memory

OCGM 기준 파일:
- docs/DATA_FORGE_HANDOFF_PROMPT.md
- docs/CODEX_TASKS.md
- src/extract/relation-fields.ts
- src/extract/relation-candidates.ts
- src/extract/data-forge-adapter.ts
- src/extract/data-forge-adapter.test.ts

Obsidian 운영 문서:
- /Users/flytothesky/Library/CloudStorage/GoogleDrive-kskileco@gmail.com/내 드라이브/Obsidian/21_업무노트/정보기술/neo4j/00 프로젝트 운영 인덱스.md
- /Users/flytothesky/Library/CloudStorage/GoogleDrive-kskileco@gmail.com/내 드라이브/Obsidian/21_업무노트/정보기술/neo4j/02 출력 계약 관리.md
- /Users/flytothesky/Library/CloudStorage/GoogleDrive-kskileco@gmail.com/내 드라이브/Obsidian/21_업무노트/정보기술/neo4j/의사결정/2026-06-23 - Data Forge 메타데이터 연계 검토.md

확인할 OCGM 호환 frontmatter 필드:
- relation fields: related, supports, depends_on, part_of, affects, evidenced_by, mentions_people, mentions_orgs, mentions_systems, mentions_projects
- supported aliases: related_note, related_notes, relations, support, supporting, depends, dependencies, parent, parent_project, impact, impacts, evidence, sources, mentions_person, mentions_persons, mentions_people_names, mentions_org, mentions_organization, mentions_organizations, mentions_system, mentions_tool, mentions_tools, mentions_project, project_mentions
- Data Forge metadata fields: source_context, template_style_id, quality_asset_profile, exemplar_archetype, project_name, doc_class, source_uri, source_hash

작업 목표:
1. Data Forge 생성 노트 샘플의 frontmatter를 찾고 위 필드가 안정적으로 생성되는지 확인한다.
2. 누락되거나 다른 이름으로 생성되는 relation field가 있으면 OCGM alias와 맞출지, Data Forge 출력 계약을 수정할지 제안한다.
3. 수정이 필요하면 Data Forge 프로젝트 안에서만 최소 변경한다.
4. Data Forge runtime이나 Codex CLI 자동 실행을 새로 추가하지 않는다.
5. 샘플 생성 노트 1개를 기준으로 OCGM의 `Context Graph Memory: Show Metadata Extraction Preview`에서 `related`, `supports`, `mentions_*`가 relation candidate로 보일 수 있는지 확인 가능한 결과를 보고한다.

검증:
- Data Forge 프로젝트의 기존 테스트/빌드 명령을 실행한다.
- 가능하면 Data Forge 샘플 노트 frontmatter를 제시한다.
- OCGM repo를 수정하지 않았음을 보고한다.
```
