import os
import re
import glob

def find_wrappers():
    wrappers = []
    for root, dirs, files in os.walk('src'):
        for file in files:
            if file.endswith('.css') and not re.search(r'\.part\d+\.css$', file):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                except Exception as e:
                    print(f"Error reading {filepath}: {e}")
                    continue
                
                basename_no_ext = os.path.splitext(file)[0]
                import_pattern = r'@import\s+[\'"](?:\./)?(' + re.escape(basename_no_ext) + r'\.part\d+\.css)[\'"]\s*;?'
                
                matches = re.findall(import_pattern, content)
                if not matches:
                    continue
                
                # Check if it has any other content
                stripped = content
                stripped = re.sub(import_pattern, '', stripped)
                stripped = re.sub(r'//.*', '', stripped)
                stripped = re.sub(r'/\*.*?\*/', '', stripped, flags=re.DOTALL)
                
                if stripped.strip() == "":
                    wrappers.append((filepath, file, matches))
    return wrappers

def get_concatenated_content(wrapper_path, parts):
    full_content_parts = []
    for part in parts:
        part_path = os.path.join(os.path.dirname(wrapper_path), part)
        if not os.path.exists(part_path):
            print(f"Warning: Part file not found: {part_path}")
            continue
        with open(part_path, 'r', encoding='utf-8') as f:
            part_content = f.read()
        full_content_parts.append(part_content)
        
    joined = ""
    for p_con in full_content_parts:
        joined += p_con
        if p_con and not p_con.endswith('\n'):
            joined += '\n'
    return joined

def analyze_css(content):
    depth = 0
    in_comment = False
    in_string = None  # '"' or "'"
    escaped = False
    
    lines = []
    current_line_chars = []
    
    i = 0
    n = len(content)
    while i < n:
        c = content[i]
        
        # Handle escape inside string
        if escaped:
            escaped = False
            current_line_chars.append(c)
            if c == '\n':
                lines.append((''.join(current_line_chars), False))
                current_line_chars = []
            i += 1
            continue
            
        if in_comment:
            if c == '*' and i + 1 < n and content[i+1] == '/':
                in_comment = False
                current_line_chars.append('*/')
                i += 2
                continue
            else:
                current_line_chars.append(c)
                if c == '\n':
                    lines.append((''.join(current_line_chars), False))
                    current_line_chars = []
                i += 1
                continue
                
        if in_string:
            if c == '\\':
                escaped = True
                current_line_chars.append(c)
                i += 1
                continue
            elif c == in_string:
                in_string = None
                current_line_chars.append(c)
                i += 1
                continue
            else:
                current_line_chars.append(c)
                if c == '\n':
                    lines.append((''.join(current_line_chars), False))
                    current_line_chars = []
                i += 1
                continue
                
        # Outside comment and string
        if c == '/' and i + 1 < n and content[i+1] == '*':
            in_comment = True
            current_line_chars.append('/*')
            i += 2
            continue
        elif c in ('"', "'"):
            in_string = c
            current_line_chars.append(c)
            i += 1
            continue
        elif c == '{':
            depth += 1
            current_line_chars.append(c)
            i += 1
            continue
        elif c == '}':
            depth = max(0, depth - 1)
            current_line_chars.append(c)
            i += 1
            continue
        else:
            current_line_chars.append(c)
            if c == '\n':
                is_safe = (depth == 0 and not in_comment and not in_string)
                lines.append((''.join(current_line_chars), is_safe))
                current_line_chars = []
            i += 1
            continue
            
    if current_line_chars:
        is_safe = (depth == 0 and not in_comment and not in_string)
        lines.append((''.join(current_line_chars), is_safe))
        
    return lines

def split_into_chunks(lines):
    chunks = []
    current_chunk = []
    for line, is_safe in lines:
        current_chunk.append(line)
        if len(current_chunk) >= 600 and is_safe:
            chunks.append(current_chunk)
            current_chunk = []
    if current_chunk:
        chunks.append(current_chunk)
    return chunks

def main():
    wrappers = find_wrappers()
    print(f"Found {len(wrappers)} wrappers.")
    
    transformed_count = 0
    for filepath, filename, parts in sorted(wrappers):
        dir_name = os.path.dirname(filepath)
        basename_no_ext = os.path.splitext(filename)[0]
        
        print(f"Processing wrapper: {filepath}")
        
        # 2) Recover full content
        full_content = get_concatenated_content(filepath, parts)
        
        # 3) Re-split into chunks
        lines = analyze_css(full_content)
        chunks = split_into_chunks(lines)
        
        print(f"  Lines: {len(lines)}, split into {len(chunks)} chunks.")
        
        # Determine all existing part files of this wrapper
        existing_parts_pattern = os.path.join(dir_name, f"{basename_no_ext}.part*.css")
        existing_part_files = set(glob.glob(existing_parts_pattern))
        
        # 4) Rewrite part files with new chunks and rewrite wrapper imports
        new_part_filenames = []
        new_part_filepaths = set()
        for i, chunk in enumerate(chunks):
            part_filename = f"{basename_no_ext}.part{i+1:03d}.css"
            part_filepath = os.path.join(dir_name, part_filename)
            new_part_filenames.append(part_filename)
            new_part_filepaths.add(os.path.abspath(part_filepath))
            
            chunk_content = "".join(chunk)
            with open(part_filepath, 'w', encoding='utf-8') as f:
                f.write(chunk_content)
                
        # Rewrite wrapper
        wrapper_lines = [f"@import './{p}';" for p in new_part_filenames]
        wrapper_content = "\n".join(wrapper_lines) + "\n"
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(wrapper_content)
            
        # 5) Remove any stale extra part files
        stale_count = 0
        for ext_path in existing_part_files:
            if os.path.abspath(ext_path) not in new_part_filepaths:
                os.remove(ext_path)
                stale_count += 1
                
        if stale_count > 0:
            print(f"  Removed {stale_count} stale part files.")
            
        transformed_count += 1
        
    print(f"Successfully processed {transformed_count} wrapper files.")

if __name__ == '__main__':
    main()
