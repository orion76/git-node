

interface IConfigPreCommit {
  bad_words: Record<string, string[]>,
  patterns: Record<string, string>,
}

interface ISearchResultLine {
  group:string;
  row: number,
  match: string[],
  source: string
}


interface ISearchResultFile {
  file: string;
  result: ISearchResultLine[];
}
