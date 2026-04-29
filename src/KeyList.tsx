export const KeyList = ({
	id,
	keyName,
	otp,
	onEdit,
	setKeyName,
	setKeyID,
}: {
	id: string;
	keyName: string;
	otp: string;
	onEdit: () => void;
	setKeyName: (name: string) => void;
	setKeyID: (id: string) => void;
}) => {
	return (
		<div className="w-60 h-16 bg-gray-800 rounded m-1 flex items-center justify-between px-4">
			<div>
				<h2 className="text-xl">{keyName}</h2>
				<p className="text-2xl">{otp}</p>
			</div>
			<div className="flex space-x-2">
				<button
					onClick={() => {
						setKeyName(keyName);
						setKeyID(id);
						onEdit();
					}}
					className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded"
				>
					Edit
				</button>
			</div>
		</div>
	);
};
