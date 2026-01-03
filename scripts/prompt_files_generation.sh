#!/bin/bash

# Check if at least one directory path is provided
if [ $# -eq 0 ]; then
	echo "Usage: $0 <directory_path1> [directory_path2] [directory_path3] ..."
	echo "Example: $0 /path/to/dir1 /path/to/dir2 /path/to/dir3"
	exit 1
fi

OUTPUT_DIR=".prompt_files"

# Validate all directories exist before proceeding
echo "Validating directories..."
for SOURCE_DIR in "$@"; do
	if [ ! -d "$SOURCE_DIR" ]; then
		echo "Error: Directory '$SOURCE_DIR' does not exist."
		exit 1
	fi
done
echo "All directories validated successfully."
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Create directory structure file
STRUCTURE_FILE="$OUTPUT_DIR/directory_structure.txt"
echo "# Directory Structure - Original file paths" >"$STRUCTURE_FILE"
echo "# Generated on: $(date)" >>"$STRUCTURE_FILE"
echo "# Source directories:" >>"$STRUCTURE_FILE"
for SOURCE_DIR in "$@"; do
	echo "#   - $SOURCE_DIR" >>"$STRUCTURE_FILE"
done
echo "" >>"$STRUCTURE_FILE"

# Function to generate random suffix
generate_suffix() {
	echo $(date +%s%N | cut -b10-19)
}

# Function to get unique filename
get_unique_filename() {
	local base_name="$1"
	local extension="$2"
	local counter=1
	local new_name="$base_name$extension"

	while [ -f "$OUTPUT_DIR/$new_name" ]; do
		local suffix=$(generate_suffix)
		new_name="${base_name}_${suffix}${extension}"
	done

	echo "$new_name"
}

# Process each directory
echo "Output directory: $OUTPUT_DIR"
echo ""

file_count=0

for SOURCE_DIR in "$@"; do
	echo "========================================="
	echo "Processing: $SOURCE_DIR"
	echo "========================================="
	
	# Add section header to structure file
	echo "" >>"$STRUCTURE_FILE"
	echo "# Files from: $SOURCE_DIR" >>"$STRUCTURE_FILE"
	echo "# -----------------------------------------" >>"$STRUCTURE_FILE"
	
	dir_file_count=0
	
	# Find all files with specified extensions using process substitution
	while IFS= read -r -d '' file; do
		# Get just the filename without path
		filename=$(basename "$file")

		# Extract name and extension
		base_name="${filename%.*}"
		extension=".${filename##*.}"

		# Get unique filename to avoid conflicts
		unique_name=$(get_unique_filename "$base_name" "$extension")

		# Copy file
		cp "$file" "$OUTPUT_DIR/$unique_name"

		# Add to directory structure file
		echo "$file -> $unique_name" >>"$STRUCTURE_FILE"

		echo "Copied: $file -> $unique_name"
		((file_count++))
		((dir_file_count++))
	done < <(find "$SOURCE_DIR" -type f \( -name "*.js" -o -name "*.json" -o -name "*.jsx" -o -name "*.css" -o -name "*.html" \) -not -path "*/node_modules/*" -not -name "package.json" -not -name "*.schema.json" -not -name "package-lock.json" -not -name "magicNumbers.json" -not -name "DeepCompare.js" -not -name "SchemaBuilder.js" -not -name "idea for complex rule.js" -print0)
	
	echo "Copied $dir_file_count files from $SOURCE_DIR"
	echo ""
done

echo "========================================="
echo "Completed! Copied $file_count total files to $OUTPUT_DIR/"
echo "Directory structure saved to: $STRUCTURE_FILE"
echo "========================================="