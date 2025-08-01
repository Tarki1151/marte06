#!/bin/bash

# Git add all changes
git add .

# Prompt for commit message
echo "Enter commit message:"
read commit_message

# Git commit with the provided message
git commit -m "$commit_message"

# Git push to origin main
git push origin main
