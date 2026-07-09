import sys
import os
import re
import glob

def process_file(filepath, mode):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # FAILSAFE: Always clean up (post-process) first to guarantee idempotency.
    # Reverts: [data, data]; #[%include file.txt%] -> [%include file.txt%];
    clean_content = re.sub(r'\[.*?\];\s*#\[%include\s+([^%]+)%\]', r'[%include \1%];', content)

    if mode == 'post':
        new_content = clean_content
        
    elif mode == 'pre':
        def replacer(match):
            filename = match.group(1).strip()
            if os.path.exists(filename):
                with open(filename, 'r', encoding='utf-8') as inc_f:
                    file_data = inc_f.read().strip()
                # Return the injected list and append the Goboscript comment macro
                return f"{file_data}; #[%include {filename}%]"
            else:
                print(f"ERROR: Macro file '{filename}' not found!")
                return match.group(0)

        # Look for [%include filename.txt%]; and inject
        new_content = re.sub(r'\[%include\s+([^%]+)%\];', replacer, clean_content)

    # Only write to disk if changes were actually made
    if content != new_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Processed ({mode}): {filepath}")

def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ['pre', 'post']:
        print("Usage: python macro_processor.py [pre|post]")
        return

    mode = sys.argv[1]
    # Scan all .gs files in the directory
    for filepath in glob.glob('**/*.gs', recursive=True):
        process_file(filepath, mode)

if __name__ == "__main__":
    main()