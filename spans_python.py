class SourceIndex:
    """Reuse line boundaries instead of splitting the whole file for each node."""
    def __init__(self, source):
        import re
        pieces=re.split(r'(\r\n|\r|\n)',source)
        self.lines=pieces[::2]
        self.separators=pieces[1::2]

    def segment(self, node):
        if node is None or getattr(node,'end_lineno',None) is None:return ''
        first=node.lineno-1;last=node.end_lineno-1
        if first==last:return self.lines[first].encode('utf-8')[node.col_offset:node.end_col_offset].decode('utf-8')
        return (self.lines[first].encode('utf-8')[node.col_offset:].decode('utf-8')+self.separators[first]+
                ''.join(self.lines[i]+self.separators[i] for i in range(first+1,last))+
                self.lines[last].encode('utf-8')[:node.end_col_offset].decode('utf-8'))


def span(n,source):
    """Python AST columns are UTF-8 bytes; browser columns are UTF-16 units."""
    lines=source.split('\n')
    def column(line,byte):
        text=lines[line-1] if 0<line<=len(lines) else ''
        return len(text.encode('utf-8')[:byte].decode('utf-8').encode('utf-16-le'))//2
    start=n.lineno;end=getattr(n,'end_lineno',start) or start
    return dict(start=start,end=end,startColumn=column(start,n.col_offset),endColumn=column(end,getattr(n,'end_col_offset',n.col_offset) or 0))
