<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <strong>한국어</strong>
</p>

<h1 align="center">FIMI</h1>

<h3 align="center">클릭 한 번씩, 코드를 이해하다</h3>

<p align="center">AI로 무언가를 만들면서 코드도 함께 배우고 싶은 사람을 위한 코드 읽기 작업 공간</p>

<p align="center">
  <a href="https://github.com/Laurent150/FIMI/releases/latest"><img src="https://img.shields.io/github/v/release/Laurent150/FIMI?style=flat-square&amp;color=496B4A" alt="최신 릴리스"></a>
  <a href="https://github.com/Laurent150/FIMI/releases/latest"><img src="https://img.shields.io/badge/desktop-Windows%20x64-496B4A?style=flat-square" alt="Windows x64"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-DCE7A4?style=flat-square" alt="MIT 라이선스"></a>
</p>

<p align="center">
  <a href="#시작하기">시작하기</a> · <a href="#주요-기능">기능</a> · <a href="#소스에서-실행하기">소스에서 실행</a> · <a href="https://github.com/Laurent150/FIMI/issues">피드백</a>
</p>

## FIMI 사용 모습

https://github.com/user-attachments/assets/6b5deab6-18f2-4a1f-a3b5-622c61fa94fb

장바구니 결제 함수를 예로, 낯선 기호에서 시작해 “할인을 적용했는데 왜 무료 배송이 사라졌을까?”라는 질문까지 따라갑니다. 코드를 읽고 조건을 살펴본 뒤, 변경 방법을 질문하고 답변을 소스와 함께 저장합니다.

## FIMI를 만든 이유

AI로 코드를 얻는 일보다 그 코드의 동작을 이해하는 일이 더 어려울 때가 있습니다. FIMI는 소스, 흐름, 설명을 한 화면에 모아 편집기와 채팅 창, 메모 사이를 오가지 않고 읽을 수 있게 합니다.

모르는 부분부터 시작하세요. 단어나 기호를 클릭하면 현재 코드에서 어떤 역할을 하는지 알 수 있습니다. 흐름의 단계를 선택해 해당 소스로 이동하고, 추가 질문으로 문법과 실제 동작을 연결할 수 있습니다. 바이브 코딩을 하든 첫 프로그래밍 언어를 배우든, 자신이 사용하는 코드를 이해하는 것이 목표입니다.

## 주요 기능

| 기능 | 사용 방법 |
| --- | --- |
| **단어·기호·한 줄 읽기** | 이름, `=>`, 코드 한 줄을 클릭해 맥락에 맞는 설명을 확인합니다. 설명 카드는 드래그로 옮기고 다 읽은 뒤 닫을 수 있습니다. |
| **흐름 따라가기** | 함수나 모듈을 열고 단계를 선택하면 해당 소스와 설명이 나란히 표시됩니다. 전체 흐름에서 세부 내용으로 이동할 수 있습니다. |
| **코드 구간 이해하기** | 흐름 모듈이나 단계를 선택해 관련 코드를 하나의 묶음으로 읽습니다. |
| **예시 보기** | 추상적인 조건과 계산을 구체적인 입력에 적용해 변화 과정을 살펴봅니다. |
| **추가 질문하기** | 왜 이런 결과가 나오는지, 조건을 바꾸면 어떻게 되는지 현재 코드에 관해 질문합니다. |
| **저장하고 다시 보기** | 유용한 설명을 **Saved**에 저장하고 나중에 검색합니다. 저장 당시의 소스를 열면 관련 위치가 강조됩니다. |

같은 페이지에서 같은 위치를 다시 클릭하면 이미 생성된 설명을 재사용합니다. 화면과 AI 설명은 영어와 중국어 간체를 지원합니다. 기본 언어는 영어이며 선택한 언어를 기억합니다.

## 시작하기

1. **FIMI 설치.** [Windows 10/11 x64 설치 파일](https://github.com/Laurent150/FIMI/releases/download/v1.2.2/FIMI-1.2.2-Windows-x64-Setup.exe)을 다운로드하세요. Node.js와 Python이 포함되어 있어 개발 환경을 따로 준비할 필요가 없습니다.
2. **AI 연결 방식 선택.** 이메일로 로그인해 제공 중인 한도 내에서 AI 체험을 사용하거나, **AI settings**에 OpenAI 호환 API 기본 URL, 모델 이름, API 키를 입력하세요.
3. **코드 가져오기.** 붙여넣기, 파일 가져오기 또는 내장 예제로 시작하세요. 흐름 모듈을 열고 소스를 클릭한 뒤 궁금한 내용을 질문하면 됩니다.

현재 Windows 설치 파일은 코드 서명이 되어 있지 않습니다. [릴리스](https://github.com/Laurent150/FIMI/releases/latest)에 체크섬이 제공되며, 자세한 내용은 [설치 가이드](docs/WINDOWS_INSTALL.md)를 참고하세요.

### 코드 및 언어 지원

Python, JavaScript/TypeScript, Java, Bash는 로컬 구조 탐색을 지원합니다. JSON, YAML, HTML, CSS, SQL, Dockerfile 등은 형식에 맞는 구조로 표시됩니다. C/C++, Go, Rust, C#, PHP, Ruby는 가져와서 AI 설명을 요청할 수 있지만, 완전한 로컬 함수 흐름도는 아직 지원하지 않습니다.

코드 이미지를 가져와 텍스트를 인식하고 확인한 뒤 읽을 수도 있습니다. 로컬 OCR은 영어와 중국어 간체를 지원하며, AI 이미지 인식에는 이미지 입력을 지원하는 모델이 필요합니다. README 번역 언어와 앱의 화면 지원 언어는 다릅니다.

### AI, 계정 및 소스 코드

- 로컬 분석과 로컬 OCR은 AI 연결 없이 작동합니다. AI 설명에는 체험 서비스 또는 직접 설정한 제공자가 필요합니다. 체험에는 제공 여부와 사용량 제한이 적용됩니다.
- AI 기능은 관련 소스와 맥락을 선택한 서비스로 전송합니다. AI 이미지 인식은 이미지도 전송합니다. 개인 API를 사용하면 해당 제공자의 요금과 데이터 정책이 적용됩니다.
- 비로그인 상태의 저장 항목은 현재 브라우저에 남습니다. 계정 저장 항목은 설명과 **연결된 소스**를 클라우드에 동기화합니다.
- FIMI는 코드를 읽는 도구이며 실행하지 않습니다. 특히 의존성이나 주변 코드가 없는 경우, 설명과 예시를 소스와 대조해 확인하세요.

## 소스에서 실행하기

Node.js 20 이상, Python(3.12 권장), pnpm 10.15.1을 준비하세요.

```sh
git clone https://github.com/Laurent150/FIMI.git
cd FIMI
pnpm install --frozen-lockfile --ignore-scripts
pnpm start
```

<http://127.0.0.1:43127>을 엽니다. Python이 PATH에 없다면 실행 전에 `CODELINGO_PYTHON`을 실행 파일 경로로 설정하세요. Windows 개발 스크립트와 검증 방법은 [기여 가이드](CONTRIBUTING.md)에 정리되어 있습니다.

## 기여하기

버그 보고, 재현 가능한 코드 예제, 설명 개선 제안을 환영합니다. [Issue](https://github.com/Laurent150/FIMI/issues)를 열거나 PR을 제출하기 전에 [기여 가이드](CONTRIBUTING.md)를 읽어 주세요. 공유하는 내용에서 인증 정보와 비공개 코드를 제거해 주세요.

## 라이선스

FIMI는 [MIT 라이선스](LICENSE)로 배포됩니다. 타사 구성 요소와 데이터 세트에는 각각의 라이선스가 적용됩니다. [출처 및 저작자 표시](OPEN_SOURCE_REFERENCES.md)를 참고하세요.
